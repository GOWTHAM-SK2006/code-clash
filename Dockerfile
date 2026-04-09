FROM eclipse-temurin:17-jdk-alpine AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN apk add --no-cache maven && mvn clean package -DskipTests

FROM eclipse-temurin:17-jdk-alpine

WORKDIR /app
RUN apk add --no-cache python3 nodejs npm gcc g++ musl-dev && ln -sf /usr/bin/python3 /usr/bin/python
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
