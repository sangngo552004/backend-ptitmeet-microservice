Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "DANG BUILD TOAN BO MICROSERVICES BANG MAVEN" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Run maven
mvn clean package -DskipTests

if ($LASTEXITCODE -ne 0) {
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host "LOI: Build Maven that bai. Vui long kiem tra code!" -ForegroundColor Red
    Write-Host "==========================================" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "==========================================" -ForegroundColor Green
Write-Host "BUILD XONG! DANG KHOI DONG DOCKER COMPOSE" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

docker compose up -d --build
