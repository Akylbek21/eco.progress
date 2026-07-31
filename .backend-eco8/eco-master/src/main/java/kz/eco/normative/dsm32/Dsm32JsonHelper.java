package kz.eco.normative.dsm32;

import tools.jackson.databind.ObjectMapper;

import java.util.LinkedHashMap;
import java.util.Map;

public final class Dsm32JsonHelper {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private Dsm32JsonHelper() {
    }

    public static String toJson(Map<String, ?> values) {
        try {
            return OBJECT_MAPPER.writeValueAsString(values);
        } catch (Exception ex) {
            return null;
        }
    }

    public static String rawValueJson(String rawValue) {
        Map<String, String> map = new LinkedHashMap<>();
        map.put("rawValue", rawValue);
        return toJson(map);
    }

    public static String rowJson(Map<String, ?> values) {
        return toJson(values);
    }
}
