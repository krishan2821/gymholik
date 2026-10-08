package com.gymapp.module.member.service;

import com.gymapp.common.TenantContext;
import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.member.entity.Member;
import com.gymapp.module.member.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Arrays;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class PhotoService {

    private final MemberRepository memberRepository;
    private final com.gymapp.module.trainer.repository.TrainerAssignmentRepository trainerAssignmentRepository;

    @Value("${app.upload.dir:/data/uploads}")
    private String uploadDir;

    private static final List<String> ALLOWED_CONTENT_TYPES = Arrays.asList(
            "image/jpeg", "image/png", "image/webp"
    );

    @Transactional
    public String uploadPhoto(String memberId, MultipartFile file) {
        String gymId = TenantContext.getGymId();

        if (file.isEmpty()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "File is empty");
        }

        if (!ALLOWED_CONTENT_TYPES.contains(file.getContentType())) {
            throw new AppException(ErrorCode.INVALID_FILE_TYPE);
        }

        Member member = memberRepository.findByIdAndGymId(memberId, gymId)
                .orElseThrow(() -> new AppException(ErrorCode.MEMBER_NOT_FOUND));

        try {
            // Ensure directory exists: /data/uploads/{gymId}
            Path gymUploadPath = Paths.get(uploadDir, gymId).toAbsolutePath().normalize();
            Files.createDirectories(gymUploadPath);

            // Save file: /data/uploads/{gymId}/{memberId}.jpg
            String originalFilename = StringUtils.cleanPath(file.getOriginalFilename() != null ? file.getOriginalFilename() : "");
            String extension = "jpg";
            if (originalFilename.contains(".")) {
                extension = originalFilename.substring(originalFilename.lastIndexOf(".") + 1);
            }
            
            String fileName = memberId + "." + extension;
            Path targetLocation = gymUploadPath.resolve(fileName);
            
            Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);

            String relativePath = gymId + "/" + fileName;
            member.setPhotoPath(relativePath);
            memberRepository.save(member);

            return relativePath;

        } catch (IOException ex) {
            log.error("Could not store file for member " + memberId, ex);
            throw new AppException(ErrorCode.FILE_PROCESSING_ERROR);
        }
    }

    public Resource loadPhotoAsResource(String memberId) {
        String gymId = TenantContext.getGymId();

        if (com.gymapp.security.SecurityUtils.isTrainer()) {
            String trainerId = com.gymapp.security.SecurityUtils.getCurrentUserId();
            boolean isAssigned = trainerAssignmentRepository.existsByGymIdAndTrainerIdAndMemberIdAndStatus(
                    gymId, trainerId, memberId, "ACTIVE");
            if (!isAssigned) {
                throw new AppException(ErrorCode.MEMBER_NOT_FOUND, "Member not found");
            }
        }

        Member member = memberRepository.findByIdAndGymId(memberId, gymId)
                .orElseThrow(() -> new AppException(ErrorCode.MEMBER_NOT_FOUND));

        if (member.getPhotoPath() == null) {
            throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "No photo found for this member");
        }

        try {
            Path filePath = Paths.get(uploadDir).resolve(member.getPhotoPath()).normalize();
            Resource resource = new UrlResource(filePath.toUri());
            if (resource.exists()) {
                return resource;
            } else {
                throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Photo file not found on disk");
            }
        } catch (MalformedURLException ex) {
            throw new AppException(ErrorCode.FILE_PROCESSING_ERROR, "File path is malformed");
        }
    }
}
