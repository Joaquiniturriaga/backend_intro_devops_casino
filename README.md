# RUNBOOK — VidalCasino EKS (EP3 DevOps)

Documento de operación y troubleshooting del clúster `vidalcasino-eks` en AWS Academy (Learner Lab). Pensado para diagnosticar rápido sin tener que repetir el proceso completo de prueba y error cada sesión.

---

## 0. Contexto rápido del clúster

- **Cluster:** `vidalcasino-eks` — región `us-east-1`
- **Nodos:** 2x `t3.small` (uno en `us-east-1a`, otro en `us-east-1b`) — límite ENI ≈ 11 pods/nodo
- **Servicios:** `casino-frontend`, `casino-backend`, `bonos-service`, `apuestas-service`, `estadisticas-service`, `postgres` (en pod, con PVC)
- **HPA:** `casino-frontend` y `apuestas-service` (CPU 50%, min 2 / max 6). Los demás van con `replicas: 1` fijo por límite de pods por nodo.
- **Secret compartido:** `casino-secrets` (credenciales BD + `JWT_SECRET`)
- **Cuenta AWS:** `883811547490`

---

## 1. Refrescar credenciales de AWS Academy (cada ~4 horas)

Las credenciales del Learner Lab expiran cada ~4h. Si cualquier comando `aws` o `kubectl` empieza a fallar con errores de autenticación, este es el primer paso siempre.

1. Ir al panel del Learner Lab (Vocareum) → **AWS Details** → copiar el bloque `[default]`.
2. Pegarlo en `~/.aws/credentials`.
3. Verificar:
```bash
aws sts get-caller-identity
```
4. Reconectar `kubectl` al clúster:
```bash
aws eks update-kubeconfig --name vidalcasino-eks --region us-east-1
```

> Esto también hay que repetirlo en **GitHub Secrets** (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`) en los 5 repos antes de disparar cualquier pipeline, si pasaron más de ~4h desde la última vez que los actualizaste.

---

## 2. Apagar y encender el clúster (control de gasto)

AWS Academy no tiene Cost Explorer normal — el gasto real se ve en la barra de presupuesto del **Learner Lab en Vocareum**, no en la consola de AWS.

### Apagar (bajar nodos a 0, sin borrar el clúster)
Detiene el cobro de las instancias EC2 (la parte más cara). El control plane de EKS sigue existiendo pero cuesta centavos por hora.


aws eks list-nodegroups --cluster-name vidalcasino-eks

aws eks update-nodegroup-config \
  --cluster-name vidalcasino-eks \
  --nodegroup-name <nombre-nodegroup> \
  --scaling-config minSize=2,maxSize=2,desiredSize=2
```bash


aws eks list-nodegroups --cluster-name vidalcasino-eks

aws eks update-nodegroup-config \
  --cluster-name vidalcasino-eks \
  --nodegroup-name <nombre-nodegroup> \
  --scaling-config minSize=0,maxSize=2,desiredSize=0
```

### Encender de nuevo
```bash
aws eks update-nodegroup-config \
  --cluster-name vidalcasino-eks \
  --nodegroup-name <nombre-nodegroup> \
  --scaling-config minSize=2,maxSize=2,desiredSize=2
```

⚠️ **Importante:** al volver a subir los nodos, son **instancias EC2 nuevas**. Esto casi siempre rompe el EBS CSI driver por el fix de IMDS (ver sección 3) — aplicar ese fix es el primer paso obligatorio después de cada reencendido.

### Borrar el clúster completo (si no se va a tocar por varios días)
```bash
eksctl delete cluster --name vidalcasino-eks --region us-east-1
```
Detiene también el cobro del control plane. Usar solo si se va a reconstruir todo desde cero más adelante (por ejemplo, dejar todo listo y recrear recién el jueves/viernes antes del freeze).

---

## 3. Fix recurrente: IMDS hop-limit roto en nodos nuevos

### Síntoma
```
kubectl get pods -n kube-system -l app=ebs-csi-controller
# 1/6 CrashLoopBackOff
```
En los logs:
```
kubectl logs <pod-ebs-csi-controller> -n kube-system -c ebs-plugin --tail=20
# "no EC2 IMDS role found ... context deadline exceeded"
```
Efecto en cascada: `postgres` queda en `ContainerCreating` (no puede adjuntar el volumen EBS) → los 4 backends que dependen de la BD entran en `CrashLoopBackOff` (el readiness/liveness falla) → `casino-frontend` sigue `1/1 Running` porque su probe no depende de la BD.

### Causa
El permiso para que el CSI driver hable con la API de AWS depende del IMDS (metadata de la instancia), y el `http-put-response-hop-limit` por defecto bloquea esa llamada desde dentro de un pod. El fix es **por-instancia EC2**, no persiste si AWS Academy recicla las instancias del node group (pasa cada vez que el Learner Lab se reinicia o las instancias se reemplazan).

### Fix paso a paso
```bash
# 1. Confirmar credenciales y reconectar kubectl
aws sts get-caller-identity
aws eks update-kubeconfig --name vidalcasino-eks --region us-east-1

# 2. Ver IPs internas de los nodos actuales
kubectl get <nodes> -o wide

# 3. Obtener los instance-id reales a partir de esas IPs
aws ec2 describe-instances \
  --filters "Name=private-ip-address,Values=<IP-nodo-1>,<IP-nodo-2>" \
  --query "Reservations[].Instances[].InstanceId" \
  --output text

# 4. Aplicar el fix a CADA instance-id devuelto
aws ec2 modify-instance-metadata-options --instance-id <id-1> --http-put-response-hop-limit 2 --http-tokens required
aws ec2 modify-instance-metadata-options --instance-id <id-2> --http-put-response-hop-limit 2 --http-tokens required

# 5. Forzar reinicio del EBS CSI controller
kubectl delete pod -n kube-system -l app=ebs-csi-controller

# 6. Verificar que llegue a 6/6 Running en ambos pods
kubectl get pods -n kube-system -l app=ebs-csi-controller
```

Apenas el CSI esté `6/6 Running`, Postgres pasa solo a `1/1 Running` en 1-2 min (el `attachdetach-controller` reintenta automático, no hace falta tocar nada más). Los backends en `CrashLoopBackOff` se recuperan solos en su siguiente reintento de backoff; si no querés esperar, fuerza con:
```bash
kubectl rollout restart deployment casino-backend bonos-service apuestas-service estadisticas-service
```

---

## 4. Problema: Postgres en `Pending` por afinidad de zona (AZ) + límite de pods

### Síntoma
```bash
kubectl describe pod postgres-xxxxx | tail -10
# "0/2 nodes are available: 1 Too many pods, 1 node(s) didn't match PersistentVolume's node affinity"
```

### Causa
El volumen EBS de Postgres es **zonal** (anclado a una AZ específica, ej. `us-east-1b`). Si el nodo de esa AZ está lleno (límite ENI del `t3.small` ≈ 11 pods) y el otro nodo está en otra AZ, Postgres no tiene ningún lugar válido: el nodo correcto está lleno, y el nodo con espacio es la AZ incorrecta.

### Diagnóstico
```bash
# Ver en qué AZ exige el volumen
kubectl get pv -o jsonpath='{.items[0].spec.nodeAffinity}'

# Ver en qué AZ está cada nodo
kubectl get nodes -L topology.kubernetes.io/zone

# Ver cuántos pods tiene cada nodo y cuáles son
kubectl get pods --all-namespaces -o wide --field-selector spec.nodeName=<nombre-nodo>
```

### Fix rápido
Liberar un slot en el nodo de la AZ correcta. Si hay algo duplicado o un pod crasheado innecesario en ese nodo (por ejemplo, dos réplicas del `ebs-csi-controller` apiladas en el mismo nodo):
```bash
kubectl delete pod <nombre-pod-redundante> -n <namespace>
```
Si es uno de los backends crasheando sin servir (porque depende de la BD caída), se puede bajar a 0 momentáneamente para liberar espacio:
```bash
kubectl scale deployment <nombre-servicio> --replicas=0
# esperar que postgres entre
kubectl scale deployment <nombre-servicio> --replicas=1
```

### Nota para el informe
Esto es una limitación real de tener solo 2 nodos en 2 AZs distintas con un volumen EBS zonal — en producción se resolvería con `nodeSelector`/affinity explícito para el pod de BD, o usando un servicio gestionado (RDS) en vez de Postgres-en-pod.

---

## 5. HPA muestra `<unknown>` en TARGETS

### Síntoma
```bash
kubectl get hpa
# TARGETS: <unknown>/50%
```

### Causas posibles, en orden de probabilidad
1. **Recién aplicado:** el HPA necesita 1-2 min desde que el pod existe para tener la primera muestra de métricas. Esperar y volver a correr `kubectl get hpa`.
2. **`metrics-server` no está sano:**
```bash
kubectl get pods -n kube-system -l k8s-app=metrics-server
kubectl top pods
```
   Si `kubectl top pods` falla, el problema es el metrics-server, no el HPA en sí.
3. **Falta `resources.requests.cpu`** en el Deployment — sin esa referencia el HPA no tiene contra qué medir el %. Confirmar:
```bash
kubectl get deployment <nombre> -o jsonpath='{.spec.template.spec.containers[0].resources}'
```
4. **Conflicto entre el add-on gestionado de EKS y una instalación manual de metrics-server** (puede pasar si en algún momento se instaló a mano encima del add-on). Verificar que solo exista una fuente:
```bash
kubectl get deployment -n kube-system metrics-server -o yaml | grep -i "app.kubernetes.io/managed-by"
```

---

## 6. Comandos de diagnóstico general (cheat sheet)

```bash
# Estado de todos los pods
kubectl get pods

# Estado con detalle de nodo, IP, reinicios
kubectl get pods -o wide

# Ver el porqué de un estado Pending/CrashLoopBackOff (sección Events al final)
kubectl describe pod <nombre-pod>

# Logs de un pod (agregar -c <container> si el pod tiene varios containers)
kubectl logs <nombre-pod>
kubectl logs <nombre-pod> -c <nombre-container> --tail=20

# Forzar recreación de un pod sin esperar el backoff
kubectl delete pod <nombre-pod>

# Reinicio limpio de uno o varios Deployments
kubectl rollout restart deployment <nombre1> <nombre2>

# Ver estado de un rollout
kubectl rollout status deployment/<nombre>

# Deshacer el último rollout (vuelve a la ReplicaSet anterior)
kubectl rollout undo deployment/<nombre>

# Escalar manualmente (debug rápido, no usar en servicios con HPA)
kubectl scale deployment <nombre> --replicas=<n>

# Ver nodos, su zona y cuánta capacidad usan
kubectl get nodes -o wide
kubectl get nodes -L topology.kubernetes.io/zone
kubectl describe node <nombre-nodo> | grep -A5 "Non-terminated Pods"

# Ver el HPA en vivo
kubectl get hpa -w

# Ver pods de un servicio específico
kubectl get pods -l app=<nombre-servicio>

# Confirmar el nombre exacto del container dentro de un Deployment (para kubectl set image)
kubectl get deployment <nombre> -o jsonpath='{.spec.template.spec.containers[0].name}'
```

---

## 7. Comandos ECR

```bash
# Ver la URI completa de un repo ECR
aws ecr describe-repositories --repository-names <nombre> --query 'repositories[0].repositoryUri' --output text

# Ver los 5 repos de una sola pasada
aws ecr describe-repositories --query 'repositories[*].repositoryUri' --output table

# Crear un repo si falta
aws ecr create-repository --repository-name <nombre>

# Login manual a ECR desde la terminal (para probar push a mano)
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 883811547490.dkr.ecr.us-east-1.amazonaws.com
```

---

## 8. Flujo de Git (ramas obligatorias)

```bash
# Trabajo diario: siempre en dev
git checkout dev
git add .
git commit -m "feat: descripción clara del cambio"
git push origin dev

# Disparar el pipeline CI/CD: mergear dev -> deploy
git checkout deploy
git merge dev
git push origin deploy
# (esto activa el workflow de GitHub Actions automáticamente)
```

Prefijos de commit usados en este proyecto: `feat:`, `fix:`, `chore:`, `ci:`, `docs:`.

---

## 9. GitHub Secrets (por repo, los 5)

Configurar en cada uno de los 5 repos → **Settings → Secrets and variables → Actions**:

| Secret | Origen |
|---|---|
| `AWS_ACCESS_KEY_ID` | Panel Learner Lab → AWS Details |
| `AWS_SECRET_ACCESS_KEY` | Mismo lugar |
| `AWS_SESSION_TOKEN` | Mismo lugar (expira ~4h, hay que refrescarlo seguido) |

Con `gh` CLI, para automatizar (ejemplo un repo, repetir cambiando `--repo`):
```bash
gh secret set AWS_ACCESS_KEY_ID --body "<valor>" --repo <usuario>/<repo>
gh secret set AWS_SECRET_ACCESS_KEY --body "<valor>" --repo <usuario>/<repo>
gh secret set AWS_SESSION_TOKEN --body "<valor>" --repo <usuario>/<repo>
```

> Recordatorio crítico: actualizar estos 3 secrets en los 5 repos **justo antes** de la demo en vivo del día de la defensa, no la noche anterior — las credenciales no van a durar hasta el día siguiente.

---

## 10. Checklist antes del freeze (viernes 26/06, 23:59)

- [ ] Los 6 pods (5 servicios + postgres) en `1/1 Running`
- [ ] `kubectl get hpa` muestra TARGETS reales (no `<unknown>`) en frontend y apuestas-service
- [ ] Los 5 pipelines de GitHub Actions corridos con éxito al menos una vez
- [ ] Prueba de carga con k6 ejecutada, con capturas de `kubectl get hpa -w` y `kubectl get pods -w` mostrando el escalado
- [ ] Demo end-to-end (login → operación → historial) probada por la URL pública del LoadBalancer
- [ ] Autorecuperación demostrada (`kubectl delete pod` → se recrea solo) con captura
- [ ] README.md actualizado en los 5 repos
- [ ] Informe técnico (máx. 10 páginas) con diagrama EKS y métricas de carga
- [ ] Documento de evidencias con capturas ya pegadas
- [ ] GitHub Secrets actualizados con credenciales frescas antes de subir el entregable
- [ ] Commits descriptivos limpios, sin `node_modules`/`.env`/`__pycache__` en los repos

