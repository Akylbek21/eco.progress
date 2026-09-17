# --- build stage ---
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace

COPY pom.xml ./
RUN mvn -B -q -e -DskipTests dependency:go-offline

COPY src ./src
RUN mvn -B -q -DskipTests package && \
    mv target/*.jar /workspace/app.jar

# --- runtime stage ---
FROM eclipse-temurin:21-jdk
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends libreoffice-writer fonts-dejavu fonts-liberation && \
    rm -rf /var/lib/apt/lists/*

RUN useradd --system --uid 1001 --create-home eco
USER eco

COPY --from=build /workspace/app.jar /app/app.jar

ENV SPRING_PROFILES_ACTIVE=docker \
    JAVA_OPTS="-Xms256m -Xmx512m -XX:+UseSerialGC -XX:MaxMetaspaceSize=256m -XX:+ExitOnOutOfMemoryError -XX:NativeMemoryTracking=summary -Dspring.profiles.active=docker" \
    SERVER_PORT=8080

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
