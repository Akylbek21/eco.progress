package kz.eco.signature;

public record SignatureInfo(
    String subjectDN,
    String commonName,
    String serialNumber,
    String organization,
    boolean verified
) {}
