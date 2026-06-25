FROM maven:3.9.8-eclipse-temurin-21 AS build

WORKDIR /workspace
COPY . .
RUN mvn -pl notification-service -am clean package -DskipTests

FROM eclipse-temurin:21-jre-alpine
VOLUME /tmp
COPY --from=build /workspace/notification-service/target/notification-service-*.jar app.jar
ENTRYPOINT ["java","-jar","/app.jar"]
