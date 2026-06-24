Bueno despues de 100 horas fulminando neuronas y tokens aqui el readme final

En primer lugar te recomiendo leer este glosario para que puedas ir a la guerra y te seran utiles :)

1)Kubernetes:

1.1)Pod

  La unidad mínima de ejecución en Kubernetes.

  Pod
  └─ Container (Docker)

  Ejemplo:

  kubectl get pods


1.2)Deployment

  Define cuántos pods deben existir.

  replicas: 3

  Si un pod muere:

  Deployment
  ↓
  ReplicaSet
  ↓
  Nuevo Pod

1.3)Service:

  Permite que otros pods encuentren una aplicación.

  Frontend
  ↓
  Service
  ↓
  Backend

  Sin importar si el pod cambia de IP.


1.5)Namespace

  Carpeta lógica dentro del cluster.

  Ejemplo:

  kube-system
  default
  monitoring

1.6)Estados importantes

  Running

  Todo bien.

  1/1 Running
  Pending

  Kubernetes quiere crear el pod pero no encuentra dónde.

  Causas típicas:

  Falta CPU
  Falta RAM
  PVC no disponible
  Node affinity
  ContainerCreating

  Está construyendo el pod.

  A veces significa:

  Esperando volumen EBS
  CrashLoopBackOff

  Tu aplicación arranca y se cae continuamente.

  Inicia
  ↓
  Crash
  ↓
  Reintenta
  ↓
  Crash
  ↓
  Reintenta

  Ejemplo:

  kubectl logs pod-x

  para ver el motivo.

Storage
PVC

Persistent Volume Claim.

El pod pide almacenamiento.

Pod
 ↓
PVC
 ↓
PV
 ↓
EBS
PV

Persistent Volume.

El volumen real que usa Kubernetes.

EBS

Elastic Block Store.

Disco duro persistente de AWS.

Si matas el pod:

Datos sobreviven

porque siguen en el EBS.

CSI
CSI

Container Storage Interface.

Driver que conecta Kubernetes con discos.

En tu caso:

Kubernetes
 ↓
EBS CSI Driver
 ↓
AWS EBS

Sin CSI:

No se montan volúmenes
EBS CSI Driver

Controlador que crea y adjunta discos EBS automáticamente.

Cuando falla:

Postgres
 ↓
ContainerCreating

porque no puede montar el disco.

AWS
EC2

Máquina virtual.

Tus nodos EKS son EC2.

Node 1
Node 2
EKS

Elastic Kubernetes Service.

Servicio administrado de Kubernetes en AWS.

IAM Role

Permisos AWS.

Ejemplo:

Leer S3
Crear EBS
Leer Secrets
IMDS

Instance Metadata Service.

Servicio interno de EC2.

Dirección:

169.254.169.254

Entrega:

Región
Instance ID
IAM Credentials
IMDSv2

Versión segura de IMDS.

Usa tokens.

AWS recomienda:

IMDSv2 Required
Hop Limit

Cantidad de saltos permitidos.

Pod
 ↓
Nodo
 ↓
IMDS

Si:

Hop Limit = 1

muchos pods no llegan.

Si:

Hop Limit = 2

funciona.

Escalamiento
HPA

Horizontal Pod Autoscaler.

Aumenta o disminuye pods automáticamente.

Ejemplo:

minReplicas: 2
maxReplicas: 6
Metrics Server

Recoge métricas.

Sin él:

HPA <unknown>
CPU Requests

CPU mínima garantizada.

Ejemplo:

requests:
  cpu: 100m

HPA usa esto para calcular porcentajes.

Redes
LoadBalancer

Expone una aplicación a Internet.

Internet
 ↓
LoadBalancer
 ↓
Frontend
ClusterIP

Service interno.

Solo accesible dentro del cluster.

AWS Academy
Credentials Expired

Tu enemigo número 1.

aws sts get-caller-identity

Si falla:

Actualizar credenciales
Node Group

Grupo de nodos EC2.

Ejemplo:

2 x t3.small

Cuando lo apagas:

desiredSize = 0

Cuando lo enciendes:

desiredSize = 2
Conceptos que impresionan en una defensa
Node Affinity

Obliga un pod a ejecutarse en ciertos nodos.

Availability Zone (AZ)

Datacenter físico.

Ejemplo:

us-east-1a
us-east-1b
Auto Healing

Capacidad de Kubernetes de recuperarse solo.

Ejemplo:

kubectl delete pod frontend-123

Kubernetes:

Pod eliminado
↓
Deployment detecta falta
↓
Crea uno nuevo
Rollout

Despliegue de nueva versión.

kubectl rollout restart deployment frontend
Rollback

Volver a la versión anterior.

kubectl rollout undo deployment frontend