<<<<<<< HEAD
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




ver usuario root 
docker run --rm -it apuestas-service id
=======
# casino-backend

Backend del **Casino Online** — Experiencia 2 de la asignatura
**Introducción a Herramientas DevOps (ISY1101)**.

API REST en Node.js + Express con PostgreSQL como base de datos.

> **Este repositorio NO incluye `Dockerfile`, `docker-compose.yml`
> ni workflows de GitHub Actions.** Esos artefactos forman parte del
> entregable de la **Evaluación Parcial 2** y deben construirlos los
> estudiantes (frontend + backend + base de datos contenerizados,
> publicados en un registry y desplegados en EC2).

---

## Stack

- Node.js 20 (recomendado correr sobre `node:20-alpine`)
- Express 4
- PostgreSQL 16 (recomendado `postgres:16-alpine` con volumen nombrado)
- JWT para autenticación, bcryptjs para hashes
- `pg` como cliente de Postgres

---

## Estructura

```
casino-backend/
├── src/
│   ├── server.js                ← bootstrap Express + rutas
│   ├── db/
│   │   ├── pool.js              ← Pool de pg + esperarBD()
│   │   └── seed.js              ← usuarios demo (idempotente)
│   ├── middleware/
│   │   └── auth.js              ← JWT firmar / requiereAuth
│   ├── routes/
│   │   ├── auth.js              ← /api/auth/login | register
│   │   ├── users.js             ← /api/usuarios/me, depositar
│   │   ├── games.js             ← /api/juegos/{slots,roulette,blackjack}
│   │   └── transactions.js      ← /api/transacciones (historial)
│   └── games/
│       ├── slots.js
│       ├── roulette.js
│       └── blackjack.js
├── db/
│   └── init.sql                 ← esquema (lo monta Postgres en /docker-entrypoint-initdb.d)
├── package.json
├── .gitignore
└── .env.example
```

---

## Variables de entorno

| Variable        | Default       | Descripción                                   |
|-----------------|---------------|-----------------------------------------------|
| `PORT`          | `3000`        | Puerto HTTP del servidor                      |
| `JWT_SECRET`    | `cambiame`    | Secreto de firma JWT (cambiar en producción)  |
| `JWT_EXPIRES_IN`| `8h`          | Vigencia del token                            |
| `DB_HOST`       | `localhost`   | Host de Postgres (`db` en docker-compose)     |
| `DB_PORT`       | `5432`        | Puerto Postgres                               |
| `DB_USER`       | `casino`      | Usuario Postgres                              |
| `DB_PASSWORD`   | `casino`      | Password Postgres                             |
| `DB_NAME`       | `casino_db`   | Base de datos                                 |
| `CORS_ORIGIN`   | `*`           | Lista CSV de orígenes permitidos              |

---

## Endpoints

### Autenticación

| Método | Ruta                  | Descripción                              |
|--------|-----------------------|------------------------------------------|
| POST   | `/api/auth/register`  | Registro `{ username, email, password }` |
| POST   | `/api/auth/login`     | Login `{ username, password }`           |

### Usuario autenticado (header `Authorization: Bearer <token>`)

| Método | Ruta                                  | Descripción                       |
|--------|---------------------------------------|-----------------------------------|
| GET    | `/api/usuarios/me`                    | Datos del usuario y saldo         |
| POST   | `/api/usuarios/me/depositar`          | `{ monto }` — recarga saldo demo  |
| GET    | `/api/transacciones?limit=50`         | Historial del usuario             |

### Juegos

| Método | Ruta                              | Descripción                                                    |
|--------|-----------------------------------|----------------------------------------------------------------|
| GET    | `/api/juegos`                     | Catálogo (slots, roulette, blackjack)                          |
| POST   | `/api/juegos/slots/jugar`         | `{ apuesta }` → `{ resultado, saldo }`                         |
| POST   | `/api/juegos/roulette/jugar`      | `{ apuestas:[{tipo,valor,monto}] }` → `{ resultado, saldo }`  |
| POST   | `/api/juegos/blackjack/iniciar`   | `{ apuesta }` → `{ sesionId, jugador, banca, ... }`            |
| POST   | `/api/juegos/blackjack/accion`    | `{ sesionId, accion: pedir/plantarse/doblar }`                 |

### Salud

| Método | Ruta       | Descripción                  |
|--------|------------|------------------------------|
| GET    | `/health`  | Estado del servidor + BD     |
| GET    | `/`        | Mensaje de bienvenida        |

---

## Usuarios demo (sembrados al arrancar)

| username   | password    | rol      | saldo inicial |
|------------|-------------|----------|---------------|
| `demo`     | `demo1234`  | jugador  | $5.000        |
| `jugador1` | `demo1234`  | jugador  | $1.000        |
| `admin`    | `admin1234` | admin    | $99.999       |

---

## Cómo correr en local (sin Docker)

Requisitos: Node 20 y un Postgres accesible.

```bash
cp .env.example .env          # ajustar credenciales
npm install                   # genera node_modules (y package-lock.json local, no se commitea)
npm start
# API disponible en http://localhost:3000
```

---

## Conceptos DevOps clave del código

Los siguientes puntos son relevantes para la contenerización y despliegue en EC2.
Busca los comentarios en el código fuente para mayor detalle.

### 1. Configuración por variables de entorno (12-factor App)
Toda la configuración sensible o que cambia entre ambientes (host de la BD,
contraseña, JWT_SECRET, puerto) viene de variables de entorno, nunca
hardcodeada. En Docker se inyectan con `-e`, en `docker-compose.yml` con la
sección `environment:`, y en EC2 se pueden usar secretos de AWS.

### 2. Endpoint `/health` y Docker HEALTHCHECK
`GET /health` consulta la BD y responde `{ status: "ok" }` o `503`.
Docker lo usa en el `HEALTHCHECK` del `Dockerfile`; los Load Balancers de AWS
lo usan para enrutar tráfico solo hacia instancias/contenedores sanos.
Deben configurar este endpoint como HEALTHCHECK en el Dockerfile del backend
y como health check en el servicio de docker-compose.

### 3. Binding a `0.0.0.0`
El servidor escucha en `0.0.0.0` (todas las interfaces), no en `localhost`.
Dentro de un contenedor, `localhost` solo aceptaría conexiones originadas
dentro del mismo contenedor; `0.0.0.0` permite que el host (EC2) y otros
contenedores puedan acceder.

### 4. Reintentos de conexión a la BD (`esperarBD`)
Cuando `docker-compose up` levanta varios servicios a la vez, el backend
puede arrancar antes de que Postgres esté listo. `esperarBD()` reintenta
hasta 30 veces con 2 s de espera. La solución definitiva es combinar esto
con `depends_on: condition: service_healthy` y un `healthcheck` en el
servicio `db` usando `pg_isready`.

### 5. Inicialización del esquema (`db/init.sql`)
Postgres ejecuta los archivos `.sql` en `/docker-entrypoint-initdb.d/`
**solo si el volumen está vacío** (primer arranque). En reinicios
posteriores el script no se vuelve a ejecutar. Por eso todas las
sentencias DDL usan `IF NOT EXISTS`. Deben montar este archivo en el
contenedor de la BD usando la sección `volumes:` del docker-compose.yml.

### 6. Seed idempotente
`seed.js` inserta usuarios demo al arrancar el backend usando
`ON CONFLICT DO NOTHING`, por lo que es seguro ejecutarlo en cada
reinicio del contenedor sin riesgo de duplicar datos ni fallar.

### 7. Pool de conexiones
`pg.Pool` mantiene hasta 10 conexiones abiertas simultáneamente.
En producción este valor debe ajustarse según la instancia RDS/Postgres
y la cantidad de réplicas del contenedor.

---

## Cómo lo van a contenerizar (EP2)

El docente espera que ustedes:

1. Construyan un **Dockerfile multi-stage** (`builder` con `npm install`,
   `runtime` `node:20-alpine` con usuario no root).
2. Definan en el `docker-compose.yml` los servicios `db`, `backend`
   (y agreguen el `frontend`) con:
   - `pg_data` como **named volume** para `/var/lib/postgresql/data`.
   - `./casino-backend/db/init.sql` montado en `/docker-entrypoint-initdb.d/`
     (recuerden: solo se ejecuta si el volumen está vacío).
   - `depends_on` con `condition: service_healthy` y un `healthcheck`
     en `db` (`pg_isready`).
   - Variables de entorno **inyectadas por compose**, sin hard-codear.
3. Configuren workflows en `.github/workflows/` que hagan
   `build → push (ECR) → deploy` en EC2 al hacer push a la rama
   correspondiente (en el **Ejercicio 2.5** se usa `main`; en la
   **EP2** la pauta oficial pide la rama `deploy`).

Lean la pauta oficial (`EP2_Instrucciones y Pauta_Encargo_Estudiante.pdf`)
para los criterios completos.

---

## Repositorio del frontend

[`casino-frontend`](../casino-frontend)
>>>>>>> upstream/main
