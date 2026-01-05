## Archivos de Configuración

- `config.development.json` - Configuración para desarrollo
- `config.production.json` - Configuración para producción

## Variables Configurables

### Socket.IO
- `socket.ip` - IP o dominio del servidor Socket.IO
- `socket.port` - Puerto del servidor (vacío para usar el puerto por defecto)
- `socket.path` - Ruta del endpoint Socket.IO

### Actualizaciones
- `updateUrl` - URL base para las actualizaciones automáticas de la aplicación

### Build
- `build.appId` - Identificador único de la aplicación
- `build.artifactName` - Nombre del archivo de instalación generado (ej: `ComplementosHumanos_stage-${version}-Setup.${ext}`)

### Imágenes
- `images.siamo` - URL de la imagen por defecto para SIAMO
- `images.sirhu` - URL de la imagen por defecto para SIRHU

## Uso

### Desarrollo
La aplicación carga automáticamente `config.development.json` cuando se ejecuta en modo desarrollo:
```bash
npm run dev
```

### Producción
La aplicación carga automáticamente `config.production.json` cuando está empaquetada.

### Build
Para crear un build con la configuración de desarrollo (stage):
```bash
npm run dist:dev
```

Para crear un build con la configuración de desarrollo (alternativa):
```bash
npm run dist
```

Para crear un build con la configuración de producción:
```bash
npm run dist:prod
```

Para crear un release con la configuración de producción:
```bash
npm run release
```