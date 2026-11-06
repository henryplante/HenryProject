package com.clearpath.review.service.social;

import com.clearpath.review.auth.CurrentUser;
import com.clearpath.review.domain.AppUser;
import com.clearpath.review.domain.AppUserRepository;
import com.clearpath.review.domain.Favorite;
import com.clearpath.review.domain.FavoriteRepository;
import com.clearpath.review.domain.Material;
import com.clearpath.review.domain.MaterialRepository;
import com.clearpath.review.web.error.ApiException;
import com.clearpath.review.web.error.ErrorCode;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FavoriteService {

    private final MaterialRepository materialRepository;
    private final AppUserRepository appUserRepository;
    private final FavoriteRepository favoriteRepository;

    public FavoriteService(
            MaterialRepository materialRepository,
            AppUserRepository appUserRepository,
            FavoriteRepository favoriteRepository) {
        this.materialRepository = materialRepository;
        this.appUserRepository = appUserRepository;
        this.favoriteRepository = favoriteRepository;
    }

    @Transactional
    public void favorite(UUID materialId, CurrentUser user) {
        Material material = materialRepository
                .findById(materialId)
                .orElseThrow(() -> notFound("Material not found"));
        if (favoriteRepository.existsByIdUserIdAndIdMaterialId(user.id(), materialId)) {
            return;
        }
        AppUser appUser =
                appUserRepository.findById(user.id()).orElseThrow(() -> notFound("User not found"));
        Favorite favorite = EntityFactory.create(Favorite.class);
        favorite.setUser(appUser);
        favorite.setMaterial(material);
        favoriteRepository.save(favorite);
    }

    @Transactional
    public void unfavorite(UUID materialId, CurrentUser user) {
        if (!materialRepository.existsById(materialId)) {
            throw notFound("Material not found");
        }
        favoriteRepository.deleteByIdUserIdAndIdMaterialId(user.id(), materialId);
    }

    private static ApiException notFound(String message) {
        return new ApiException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, message);
    }
}
