# 🚀 Guía de Deploy - Fisioterapia Gossos

## 📋 Información General

Este documento describe el proceso completo de deploy de **Fisioterapia Gossos** en un servidor con Docker y nginx como reverse proxy.

### 🏗️ Arquitectura de Deploy
- **Frontend**: React + Vite (PWA)
- **Container**: Docker multi-etapa (Node.js builder + nginx runtime)
- **Reverse Proxy**: nginx con configuración SPA optimizada
- **Puerto**: 8085 (interno del contenedor: 80)
- **Dominio**: Configurable via nginx
- **SSL**: Configurable via nginx o proxy externo

## 🛠️ Configuración del Servidor

### Requisitos Previos
- **Docker** instalado (versión 20.10+)
- **Git** para clonar el repositorio
- **SSH** acceso al servidor
- **nginx** (opcional, para reverse proxy y SSL)
- **Puertos**: 8085 disponible

### Variables de Entorno del Servidor
```bash
# En el servidor, crear archivo .env
VITE_SUPABASE_URL=your_production_supabase_url
VITE_SUPABASE_ANON_KEY=your_production_supabase_key
VITE_APP_NAME="Fisioterapia Gossos"
VITE_APP_VERSION="1.0.0"
```

## 🚀 Proceso de Deploy

### 1. Preparación del Código
```bash
# En tu máquina local
git add .
git commit -m "feat: nueva versión para deploy"
git push origin main

# En el servidor
cd /path/to/fisioterapia-gossos
git pull origin main
```

### 2. Deploy Automático (Recomendado)
El script `deploy.sh` maneja todo automáticamente:

```bash
# Dar permisos de ejecución (solo la primera vez)
chmod +x deploy.sh

# Ejecutar deploy
./deploy.sh
```

### 3. Deploy Manual (Paso a Paso)
Si prefieres control manual:

```bash
# 1. Parar contenedor existente
docker stop fisio-gossos
docker rm fisio-gossos

# 2. Construir nueva imagen
TIMESTAMP=$(date +%s)
docker build -t fisio-gossos:$TIMESTAMP -t fisio-gossos:latest .

# 3. Lanzar nuevo contenedor
docker run -d \
  --name fisio-gossos \
  --restart unless-stopped \
  -p 8085:80 \
  fisio-gossos:latest

# 4. Verificar funcionamiento
curl http://127.0.0.1:8085/
```

## 🔧 Configuración Avanzada

### nginx Reverse Proxy (Opcional)
Para configurar un dominio personalizado y SSL:

```nginx
# /etc/nginx/sites-available/fisioterapia-gossos
server {
    listen 80;
    server_name tu-dominio.com www.tu-dominio.com;
    
    # Redirigir HTTP a HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tu-dominio.com www.tu-dominio.com;
    
    # Certificados SSL
    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/private.key;
    
    # Proxy al contenedor Docker
    location / {
        proxy_pass http://127.0.0.1:8085;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Para PWA y WebSockets
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Let's Encrypt SSL (Gratuito)
```bash
# Instalar certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Generar certificado
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com

# Auto-renovación
sudo crontab -e
# Agregar: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🔄 Sistema de Versionado

### Cache Busting Automático
El sistema incluye cache busting automático:

- **Timestamp único** por cada deploy
- **Hashes en archivos JS/CSS** (Vite automático)
- **version.json** generado dinámicamente
- **Service Worker** actualizado automáticamente

### Verificar Versión Activa
```bash
# Ver versión en producción
curl http://127.0.0.1:8085/version.json

# Ver logs del contenedor
docker logs fisio-gossos --tail 50

# Ver contenedores activos
docker ps | grep fisio-gossos
```

## 🔍 Monitoreo y Mantenimiento

### Comandos Útiles
```bash
# Ver estado del contenedor
docker ps
docker stats fisio-gossos

# Ver logs en tiempo real
docker logs fisio-gossos -f

# Entrar al contenedor (debugging)
docker exec -it fisio-gossos sh

# Reiniciar contenedor
docker restart fisio-gossos

# Ver uso de espacio Docker
docker system df
```

### Limpieza Automática
El script incluye limpieza automática de:
- ✅ Contenedores anteriores
- ✅ Imágenes Docker antigas (mantiene últimas 2)
- ✅ Archivos temporales

### Limpieza Manual (Si es necesario)
```bash
# Limpiar contenedores parados
docker container prune -f

# Limpiar imágenes sin usar
docker image prune -f

# Limpiar todo el sistema Docker (¡CUIDADO!)
docker system prune -a -f
```

## 📊 Métricas y Rendimiento

### Recursos del Contenedor
- **RAM**: ~50-100MB (nginx + archivos estáticos)
- **CPU**: Mínimo (solo sirve archivos)
- **Storage**: ~20-30MB por imagen
- **Red**: Puerto 8085

### Optimizaciones Incluidas
- ✅ **Multi-stage build** (imagen final ligera)
- ✅ **Gzip compression** activada
- ✅ **Cache headers** optimizados
- ✅ **PWA offline support**
- ✅ **Lazy loading** de assets

## 🆘 Troubleshooting

### Problemas Comunes

#### 1. Contenedor no inicia
```bash
# Ver logs de error
docker logs fisio-gossos

# Verificar que el puerto no esté en uso
sudo netstat -tlnp | grep :8085

# Verificar imagen construida
docker images | grep fisio-gossos
```

#### 2. Error 404 en rutas de React Router
- ✅ **Ya configurado** en `nginx.conf` con `try_files $uri $uri/ /index.html;`

#### 3. PWA no se actualiza
```bash
# Verificar que version.json cambie
curl http://127.0.0.1:8085/version.json

# Verificar cache headers del service worker
curl -I http://127.0.0.1:8085/sw.js
```

#### 4. Problemas de permisos
```bash
# Verificar permisos del script
ls -la deploy.sh
chmod +x deploy.sh

# Verificar usuario Docker
groups $USER
sudo usermod -aG docker $USER
```

#### 5. Error de build
```bash
# Limpiar cache Docker
docker builder prune -f

# Build con más verbosidad
docker build --no-cache --progress=plain -t fisio-gossos:debug .
```

## 📋 Checklist de Deploy

### Pre-Deploy
- [ ] Código committed y pushed a GitHub
- [ ] Variables .env configuradas en servidor
- [ ] Script deploy.sh con permisos de ejecución
- [ ] Puerto 8085 disponible
- [ ] Espacio suficiente en disco

### Durante Deploy
- [ ] Ejecutar `./deploy.sh`
- [ ] Verificar que no hay errores en el output
- [ ] Confirmar que curl responde 200
- [ ] Verificar nueva versión en version.json

### Post-Deploy
- [ ] Probar navegación en todas las rutas
- [ ] Verificar que PWA se puede instalar
- [ ] Confirmar notificaciones de actualización
- [ ] Revisar logs por errores
- [ ] Notificar a usuarios si es necesario

## 🔐 Seguridad

### Buenas Prácticas Implementadas
- ✅ **No root user** en contenedor
- ✅ **Headers de seguridad** en nginx
- ✅ **Variables de entorno** protegidas
- ✅ **Puertos mínimos** expuestos

### Recomendaciones Adicionales
- 🔶 Configurar **firewall** (ufw/iptables)
- 🔶 Implementar **fail2ban** para SSH
- 🔶 **Backup automático** de la base de datos
- 🔶 **Monitoreo** con logs centralizados

## 🚀 CI/CD Futuro (Opcional)

### GitHub Actions (Próxima fase)
Para automatizar completamente el deploy:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to server
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.KEY }}
          script: |
            cd /path/to/fisioterapia-gossos
            git pull origin main
            ./deploy.sh
```

---

## 📞 Soporte

Para problemas de deploy, verificar:
1. **Logs del script**: Output de `./deploy.sh`
2. **Logs del contenedor**: `docker logs fisio-gossos`
3. **Logs de nginx**: `/var/log/nginx/error.log`
4. **Estado del sistema**: `docker ps` y `docker system df`

**Documentación relacionada:**
- [SETUP.md](SETUP.md) - Configuración local
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Resolución de problemas
- [API.md](API.md) - Documentación de la API