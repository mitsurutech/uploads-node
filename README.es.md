# Subida de archivos en Node.js: S3 para los bytes, Postgres para todo lo demás

[English](README.md) | [Français](README.fr.md) | [日本語](README.ja.md) | [Español](README.es.md)

Una aplicación de ejemplo en Node.js (Express) para la [plataforma de aprendizaje MitsuruTech](https://mitsurutech.co.uk/es/learning). Subes un
archivo; S3 lo guarda; Postgres recuerda adónde fue y cómo se llama. La tabla de la
página sale de Postgres, y cada descarga sale de S3.

Es pequeña a propósito, cuatro rutas y tres archivos, para que puedas leerla entera
antes de cambiar nada.

```
server.js   the web: four routes and nothing else
store.js    the two stores, and the order they are written in
page.js     the HTML
```

## Desplegarla aquí

Abre **Deploy** en la plataforma, elige este repositorio y arranca una **base de datos** y la
**pila de nube** a su lado ([cómo funciona el despliegue desde GitHub](https://mitsurutech.co.uk/es/help/deploy-app)). Todo lo que la aplicación necesita ya está entonces en su entorno;
no hay nada que configurar.

| Variable | La define | Qué es |
| --- | --- | --- |
| `DATABASE_URL` | tu sesión | el servidor Postgres que se ejecuta como `db` |
| `AWS_ENDPOINT_URL` | tu sesión | la pila de nube que se ejecuta como `cloud` |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | tu sesión | las credenciales para acceder a ella |
| `PORT` | la plataforma | el puerto en el que escuchar |
| `BUCKET_NAME` | tú, si quieres | por defecto `uploads` |

## Las tres cosas que merece la pena leer

**1. `forcePathStyle: true`, en `store.js`.** Es el ajuste que todo el mundo olvida primero. Por
defecto, el SDK de AWS pone el bucket en el nombre de host, `uploads.cloud`, y ese nombre no existe
en la red de tu sesión, así que cada llamada falla con un error de DNS que no dice nada de
buckets. El estilo por ruta pide en su lugar `http://cloud:4566/uploads/...`.

**2. La aplicación crea su propio bucket.** Tu pila de nube arranca completamente vacía, igual que una
cuenta real de AWS recién abierta. `CreateBucket` es trabajo de tu código, se ejecuta en cada
arranque y captura «ya eres propietario de él» para que un reinicio no sea un fallo.

**3. Escribe primero S3 y luego la fila. Elimina primero la fila y luego S3.**

- Sube los bytes y luego inserta la fila. Si la inserción falla, te queda un objeto al que nadie
  apunta: invisible, inofensivo, fácil de limpiar.
- Escribe primero la fila y una subida fallida deja en la página un archivo que no se puede abrir,
  y no hay forma de distinguir esa fila de una buena.
- Eliminar va en sentido contrario por la misma razón.

Uno de esos fallos son unos pocos bytes desperdiciados. El otro es una página rota. Deja siempre que vaya primero
lo que puede quedar huérfano sin consecuencias.

## Dos hábitos de seguridad, tomados en serio en un ejemplo a propósito

**La clave de S3 es un uuid, nunca el nombre del archivo.** Dos personas suben `notes.txt` y una no debe
sobrescribir la otra; y un nombre que viene de un navegador no es algo con lo que construir una ruta:
`../../etc/passwd` es un nombre de archivo perfectamente válido para un formulario. El nombre
real es una columna, que es donde está a salvo.

**Las descargas son siempre `attachment`, siempre `application/octet-stream`, siempre `nosniff`.**
Cualquiera puede subir cualquier cosa. Un archivo HTML servido en línea se ejecutaría como una página en la dirección de tu propia aplicación,
con todo lo que esa página pueda alcanzar; guardado en el disco, es inerte.

Y cada nombre de archivo se escapa al volver a la página: un archivo llamado
`<img src=x onerror=alert(1)>` es un nombre de archivo perfectamente bueno y no debe convertirse en marcado.

## Ejecutarla en tu propio equipo

Necesitas un Postgres y algo con forma de S3. Con Docker:

```bash
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=dev --name pg postgres:16
docker run -d -p 4566:4566 --name cloud localstack/localstack

export DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_REGION=us-east-1

npm ci
npm start
```

Después abre <http://localhost:8080>.

## Qué probar a continuación

- Enviar una subida grande directamente a S3 en lugar de tenerla en memoria (`store.js` dice
  dónde).
- Añadir un contador de descargas, en DynamoDB: tu pila de nube también lo emula.
- Poner los archivos detrás de un inicio de sesión, para que la tabla sea de cada persona.
- Mostrar una vista previa de imagen, con una URL prefirmada en lugar de pasar los bytes por la aplicación.

## Licencia

Esta obra está bajo licencia [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). Puedes compartirla y adaptarla para aprender y enseñar, si citas a Mitsuru Technologies Ltd, no la usas comercialmente y compartes lo que hagas con ella bajo la misma licencia. El texto completo está en el archivo `LICENSE`.

## Acerca de

Hecho por [Mitsuru Technologies](https://mitsurutech.co.uk/es/learning), que crea la plataforma
de aprendizaje MitsuruTech para enseñar programación. El mismo ejemplo existe en otros lenguajes:
[uploads-java](https://github.com/mitsurutech/uploads-java),
[uploads-python](https://github.com/mitsurutech/uploads-python) y
[uploads-go](https://github.com/mitsurutech/uploads-go).

¿Das clase? Mira [el precio](https://mitsurutech.co.uk/es/pricing) o [crea una cuenta de centro](https://mitsurutech.co.uk/es/signup).
