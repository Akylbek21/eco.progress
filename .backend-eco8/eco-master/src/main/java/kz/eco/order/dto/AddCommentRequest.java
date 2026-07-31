package kz.eco.order.dto;

import jakarta.validation.constraints.NotBlank;
import kz.eco.order.CommentVisibility;

public record AddCommentRequest(
        @NotBlank String text,
        CommentVisibility visibility
) {}
