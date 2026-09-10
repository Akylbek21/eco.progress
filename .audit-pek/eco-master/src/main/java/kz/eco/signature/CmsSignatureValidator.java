package kz.eco.signature;

import kz.eco.common.exception.BadRequestException;
import org.bouncycastle.cms.CMSSignedData;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Base64;

@Component
public class CmsSignatureValidator {

    @Value("${eco.signature.require-cms:false}")
    private boolean requireCms;

    public void validateRequired(String signedCmsBase64) {
        if (signedCmsBase64 == null || signedCmsBase64.isBlank()) {
            if (requireCms) {
                throw new BadRequestException("Подпись CMS обязательна");
            }
            return;
        }
        validate(signedCmsBase64);
    }

    public void validate(String signedCmsBase64) {
        if (signedCmsBase64 == null || signedCmsBase64.isBlank()) {
            throw new BadRequestException("Подпись CMS пуста");
        }
        try {
            String normalized = signedCmsBase64.replaceAll("\\s+", "");
            byte[] cmsBytes = Base64.getDecoder().decode(normalized);
            if (cmsBytes.length < 32) {
                throw new BadRequestException("Подпись CMS слишком короткая");
            }
            new CMSSignedData(cmsBytes);
        } catch (BadRequestException e) {
            throw e;
        } catch (Exception e) {
            throw new BadRequestException("Невалидная подпись CMS: " + e.getMessage());
        }
    }
}
