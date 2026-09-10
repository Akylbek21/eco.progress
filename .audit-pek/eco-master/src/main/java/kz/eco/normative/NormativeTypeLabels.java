package kz.eco.normative;

import kz.eco.protocol.NormativeType;

public final class NormativeTypeLabels {

    private NormativeTypeLabels() {
    }

    public static String fromNormativeType(NormativeType type) {
        if (type == null) {
            return null;
        }
        return switch (type) {
            case PDK -> "ПДК";
            case PDV -> "ПДВ";
            case PDS -> "ПДС";
            case BACKGROUND -> "Фон";
            case RANGE -> "Диапазон";
            case INFO -> "Инфо";
        };
    }

    public static String fromImportType(ImportNormativeType type) {
        if (type == null) {
            return null;
        }
        return switch (type) {
            case PDK -> "PDK";
            case OBUV -> "OBUV";
            case ADI -> "ADI";
            case PDU -> "PDU";
            case EXPOSURE_LIMIT -> "EXPOSURE_LIMIT";
            case SUMMATION_GROUP -> "SUMMATION_GROUP";
            case CODE_GROUP -> "CODE_GROUP";
            case ASSESSMENT -> "ASSESSMENT";
        };
    }
}
