package kz.eco.storage;

public final class MongoConnectionFailures {

    private MongoConnectionFailures() {
    }

    public static boolean isConnectionFailure(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            String message = current.getMessage() != null ? current.getMessage() : "";
            if (message.contains("localhost:27017")
                    || message.contains("Connection refused")
                    || message.contains("MongoSocketOpenException")
                    || message.contains("Timed out while waiting for a server")
                    || message.contains("No route to host")
                    || message.contains("getaddrinfo failed")) {
                return true;
            }
            String className = current.getClass().getName();
            if (className.startsWith("com.mongodb.Mongo")
                    && (message.contains("timed out") || message.contains("connect"))) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }
}
