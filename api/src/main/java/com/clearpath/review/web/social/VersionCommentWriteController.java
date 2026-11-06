package com.clearpath.review.web.social;

import com.clearpath.review.auth.CurrentUser;
import com.clearpath.review.service.social.CommentWriteService;
import com.clearpath.review.web.materials.dto.CommentDto;
import com.clearpath.review.web.social.dto.CommentInputDto;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/versions/{versionId}/comments")
public class VersionCommentWriteController {

    private final CommentWriteService commentWriteService;

    public VersionCommentWriteController(CommentWriteService commentWriteService) {
        this.commentWriteService = commentWriteService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CommentDto createComment(
            @PathVariable UUID versionId,
            @Valid @RequestBody CommentInputDto body,
            CurrentUser author) {
        return commentWriteService.createComment(versionId, body.body(), author);
    }
}
