FROM maven:3.9.8-eclipse-temurin-21-alpine AS build

WORKDIR /workspace
COPY . .
RUN mvn -pl api-gateway -am clean package -DskipTests

FROM eclipse-temurin:21-jre-alpine
VOLUME /tmp
COPY --from=build /workspace/api-gateway/target/api-gateway-*.jar app.jar
ENTRYPOINT ["java","-jar","/app.jar"]
