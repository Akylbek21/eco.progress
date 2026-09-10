package kz.eco.protocol.docgen;

import kz.eco.protocol.Protocol;
import kz.eco.protocol.ProtocolEnvironmentConditions;
import kz.eco.protocol.dto.ProtocolApiDtos;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

import static kz.eco.protocol.docgen.ProtocolDocValues.*;

/**
 * Builds the {{PLACEHOLDER}} -> value map for a protocol from its stored snapshot fields
 * (company/object/laboratory data captured at creation time), never from live lookups —
 * this is what makes the generated document match what was true when the protocol was made.
 * A field the user hid via ProtocolPrintVisibility (protocol.printVisibilityJson, see
 * ProtocolApiMapper) still keeps its real value in the database and every API response —
 * only the value placed into the rendered document is blanked out here.
 */
final class ProtocolDocxPlaceholders {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private ProtocolDocxPlaceholders() {
    }

    static Map<String, String> build(Protocol protocol, ProtocolEnvironmentConditions environment) {
        ProtocolApiDtos.ProtocolPrintVisibility visibility = resolveVisibility(protocol);
        Map<String, String> map = new LinkedHashMap<>();
        map.put("{{PROTOCOL_NUMBER}}", safe(protocol.getProtocolNumber()));
        map.put("{{PROTOCOL_DATE}}", formatDate(protocol.getProtocolDate()));

        map.put("{{CUSTOMER_NAME}}", visible(visibility.organizationName())
                ? firstNonBlank(protocol.getCompanyNameSnapshot(), protocol.getOrganizationName()) : "");
        map.put("{{CUSTOMER_ADDRESS}}", visible(visibility.organizationAddress())
                ? firstNonBlank(protocol.getCompanyLegalAddressSnapshot(),
                        protocol.getCompanyActualAddressSnapshot(), protocol.getOrganizationAddress()) : "");
        map.put("{{CUSTOMER_BIN}}", safe(protocol.getCompanyBinSnapshot()));

        map.put("{{OBJECT_NAME}}", visible(visibility.testObjectName())
                ? firstNonBlank(protocol.getObjectNameSnapshot(), protocol.getObjectName()) : "");
        map.put("{{OBJECT_ADDRESS}}", safe(protocol.getObjectAddressSnapshot()));

        map.put("{{PRODUCT_NAME}}", visible(visibility.productName()) ? safe(protocol.getProductName()) : "");
        map.put("{{TEST_BASIS}}", visible(visibility.testBasis())
                ? firstNonBlank(protocol.getBasisForTesting(), protocol.getTestingBasis()) : "");
        map.put("{{MEASUREMENT_PLACE}}", visible(visibility.samplingPlace())
                ? safe(protocol.getSamplingLocationSnapshot()) : "");
        map.put("{{SAMPLING_METHOD_ND}}", visible(visibility.samplingMethodDocument())
                ? firstNonBlank(protocol.getSamplingMethodNd(), protocol.getSamplingMethodDocument()) : "");
        map.put("{{TESTING_METHOD_ND}}", visible(visibility.testMethodDocument())
                ? firstNonBlank(protocol.getTestingMethodNd(), protocol.getTestingMethodDocument()) : "");

        map.put("{{SAMPLING_DATE}}", visible(visibility.samplingDate()) ? formatDate(protocol.getSampleDate()) : "");
        map.put("{{MEASUREMENT_DATE}}", visible(visibility.measurementDate())
                ? firstNonBlankDate(protocol.getTestDate(), protocol.getSampleDate()) : "");

        LocalDate periodStart = protocol.getTestingStartDate() != null ? protocol.getTestingStartDate() : protocol.getTestDate();
        LocalDate periodEnd = protocol.getTestingEndDate() != null ? protocol.getTestingEndDate() : protocol.getTestDate();
        map.put("{{TEST_PERIOD}}", formatDatePair(
                visible(visibility.testStartDate()) ? periodStart : null,
                visible(visibility.testEndDate()) ? periodEnd : null));

        map.put("{{TEST_PURPOSE}}", visible(visibility.testPurpose())
                ? firstNonBlank(protocol.getTestPurpose(), protocol.getTestingPurpose()) : "");
        map.put("{{ENVIRONMENT_CONDITIONS}}", visible(visibility.environmentalConditions())
                ? buildEnvironmentConditions(environment, protocol.getEnvironmentConditions(),
                        visible(visibility.temperature()), visible(visibility.humidity()),
                        visible(visibility.pressure()), visible(visibility.windSpeed()))
                : "");

        map.put("{{LAB_NAME}}", safe(protocol.getLaboratoryName()));
        map.put("{{LAB_ADDRESS}}", safe(protocol.getLaboratoryAddress()));
        map.put("{{ACCREDITATION_NUMBER}}", safe(protocol.getAccreditationNumber()));
        map.put("{{ACCREDITATION_VALID_FROM}}", formatDate(protocol.getAccreditationValidFrom()));
        map.put("{{ACCREDITATION_VALID_UNTIL}}", formatDate(protocol.getAccreditationValidUntil()));

        map.put("{{EXECUTOR_NAME}}", safe(protocol.getExecutorName()));
        map.put("{{HEAD_NAME}}", firstNonBlank(protocol.getHeadOfLaboratoryName(), protocol.getDirectorName()));
        map.put("{{TOTAL_PAGES}}", protocol.getTotalPages() != null ? String.valueOf(protocol.getTotalPages()) : "1");
        return map;
    }

    /**
     * Every placeholder token whose visibility is governed by ProtocolPrintVisibility. Used by
     * ProtocolDocxTemplateRenderer to decide, per paragraph, whether ALL the controlled tokens it
     * contains are hidden (safe to drop the whole paragraph/line) - some templates print two
     * independently-toggleable fields on one line (e.g. customer name + address), so a paragraph
     * must only be dropped when none of the controlled tokens on it remain visible.
     */
    static final Set<String> PRINT_VISIBILITY_CONTROLLED_TOKENS = Set.of(
            "{{CUSTOMER_NAME}}", "{{CUSTOMER_ADDRESS}}", "{{OBJECT_NAME}}", "{{PRODUCT_NAME}}",
            "{{TEST_BASIS}}", "{{SAMPLING_DATE}}", "{{TEST_PERIOD}}", "{{SAMPLING_METHOD_ND}}",
            "{{TESTING_METHOD_ND}}", "{{TEST_PURPOSE}}", "{{MEASUREMENT_PLACE}}",
            "{{MEASUREMENT_DATE}}", "{{ENVIRONMENT_CONDITIONS}}"
    );

    /** Tokens that are entirely hidden for this protocol - i.e. nothing meaningful would be left
     * to print on their line, so the whole paragraph/row carrying them can be dropped rather than
     * just leaving an empty value next to a label. */
    static Set<String> fullyHiddenTokens(Protocol protocol) {
        ProtocolApiDtos.ProtocolPrintVisibility visibility = resolveVisibility(protocol);
        Set<String> hidden = new LinkedHashSet<>();
        if (!visible(visibility.organizationName())) hidden.add("{{CUSTOMER_NAME}}");
        if (!visible(visibility.organizationAddress())) hidden.add("{{CUSTOMER_ADDRESS}}");
        if (!visible(visibility.testObjectName())) hidden.add("{{OBJECT_NAME}}");
        if (!visible(visibility.productName())) hidden.add("{{PRODUCT_NAME}}");
        if (!visible(visibility.testBasis())) hidden.add("{{TEST_BASIS}}");
        if (!visible(visibility.samplingDate())) hidden.add("{{SAMPLING_DATE}}");
        if (!visible(visibility.testStartDate()) && !visible(visibility.testEndDate())) hidden.add("{{TEST_PERIOD}}");
        if (!visible(visibility.samplingMethodDocument())) hidden.add("{{SAMPLING_METHOD_ND}}");
        if (!visible(visibility.testMethodDocument())) hidden.add("{{TESTING_METHOD_ND}}");
        if (!visible(visibility.testPurpose())) hidden.add("{{TEST_PURPOSE}}");
        if (!visible(visibility.samplingPlace())) hidden.add("{{MEASUREMENT_PLACE}}");
        if (!visible(visibility.measurementDate())) hidden.add("{{MEASUREMENT_DATE}}");
        if (!visible(visibility.environmentalConditions())) hidden.add("{{ENVIRONMENT_CONDITIONS}}");
        return hidden;
    }

    private static boolean visible(Boolean flag) {
        return flag == null || flag;
    }

    /**
     * A field with no stored setting (new protocol, or never toggled) defaults to visible —
     * mirrors ProtocolApiMapper.toPrintVisibility, kept independent since that mapper method is
     * package-private to kz.eco.protocol and this class only needs read access to the raw JSON
     * already carried on the Protocol passed into build(...).
     */
    private static ProtocolApiDtos.ProtocolPrintVisibility resolveVisibility(Protocol protocol) {
        String json = protocol.getPrintVisibilityJson();
        if (json == null || json.isBlank()) {
            return ProtocolApiDtos.ProtocolPrintVisibility.allVisible();
        }
        Map<String, Object> stored;
        try {
            stored = OBJECT_MAPPER.readValue(json, new TypeReference<Map<String, Object>>() {
            });
        } catch (Exception ex) {
            return ProtocolApiDtos.ProtocolPrintVisibility.allVisible();
        }
        return new ProtocolApiDtos.ProtocolPrintVisibility(
                flag(stored, "organizationName"),
                flag(stored, "organizationAddress"),
                flag(stored, "testObjectName"),
                flag(stored, "productName"),
                flag(stored, "testBasis"),
                flag(stored, "samplingDate"),
                flag(stored, "testStartDate"),
                flag(stored, "testEndDate"),
                flag(stored, "productNormativeDocument"),
                flag(stored, "samplingMethodDocument"),
                flag(stored, "testMethodDocument"),
                flag(stored, "testPurpose"),
                flag(stored, "samplingPlace"),
                flag(stored, "measurementDate"),
                flag(stored, "environmentalConditions"),
                flag(stored, "temperature"),
                flag(stored, "humidity"),
                flag(stored, "pressure"),
                flag(stored, "windSpeed")
        );
    }

    private static Boolean flag(Map<String, Object> stored, String key) {
        Object value = stored.get(key);
        return value instanceof Boolean bool ? bool : true;
    }
}
