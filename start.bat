@echo off
echo ==========================================
echo DANG BUILD TOAN BO MICROSERVICES BANG MAVEN
echo ==========================================
call mvn clean package -DskipTests

if %ERRORLEVEL% NEQ 0 (
    echo ==========================================
    echo LOI: Build Maven that bai. Vui long kiem tra code!
    echo ==========================================
    exit /b %ERRORLEVEL%
)

echo ==========================================
echo BUILD XONG! DANG KHOI DONG DOCKER COMPOSE
echo ==========================================
docker compose up -d --build
