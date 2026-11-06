package com.clearpath.review.web.social;

import com.clearpath.review.auth.CurrentUser;
import com.clearpath.review.service.social.FavoriteService;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/materials/{id}/favorite")
public class FavoriteController {

    private final FavoriteService favoriteService;

    public FavoriteController(FavoriteService favoriteService) {
        this.favoriteService = favoriteService;
    }

    @PutMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void favorite(@PathVariable UUID id, CurrentUser user) {
        favoriteService.favorite(id, user);
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unfavorite(@PathVariable UUID id, CurrentUser user) {
        favoriteService.unfavorite(id, user);
    }
}
