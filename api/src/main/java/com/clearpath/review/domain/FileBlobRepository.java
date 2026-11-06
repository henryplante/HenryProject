package com.clearpath.review.domain;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FileBlobRepository extends JpaRepository<FileBlob, UUID> {}
