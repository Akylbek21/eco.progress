package kz.ecoprogress.documentflow.signing;

import kz.eco.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.List;

/** Mirrors kz.eco.common.exception.GlobalExceptionHandler's shape for the two HTTP statuses this
 *  module needs (403/422) that no existing exception type covers. Kept in a separate advice bean
 *  rather than editing the shared GlobalExceptionHandler, to stay isolated from the other agents'
 *  parallel worktrees touching kz.eco.common. */
@RestControllerAdvice
public class DocumentFlowExceptionHandler {

    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<ApiResponse<Void>> handleForbidden(ForbiddenException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(ex.getMessage(), ex.getCode(), List.of(ex.getMessage())));
    }

    @ExceptionHandler(UnprocessableEntityException.class)
    public ResponseEntity<ApiResponse<Void>> handleUnprocessable(UnprocessableEntityException ex) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(ApiResponse.error(ex.getMessage(), ex.getCode(), List.of(ex.getMessage())));
    }
}
