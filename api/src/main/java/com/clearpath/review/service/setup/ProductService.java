package com.clearpath.review.service.setup;

import com.clearpath.review.domain.Product;
import com.clearpath.review.domain.ProductRepository;
import com.clearpath.review.domain.ReviewCycleRepository;
import com.clearpath.review.domain.StepRequirement;
import com.clearpath.review.domain.StepRequirementRepository;
import com.clearpath.review.domain.UserGroup;
import com.clearpath.review.domain.UserGroupRepository;
import com.clearpath.review.domain.WorkflowStep;
import com.clearpath.review.domain.WorkflowStepRepository;
import com.clearpath.review.service.setup.SetupDtos.ProductDto;
import com.clearpath.review.service.setup.SetupDtos.ProductInputDto;
import com.clearpath.review.service.setup.SetupDtos.StepRequirementDto;
import com.clearpath.review.service.setup.SetupDtos.WorkflowStepDto;
import com.clearpath.review.web.error.ApiException;
import com.clearpath.review.web.error.ErrorCode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProductService {

    private final ProductRepository productRepository;
    private final WorkflowStepRepository workflowStepRepository;
    private final StepRequirementRepository stepRequirementRepository;
    private final UserGroupRepository userGroupRepository;
    private final ReviewCycleRepository reviewCycleRepository;

    public ProductService(
            ProductRepository productRepository,
            WorkflowStepRepository workflowStepRepository,
            StepRequirementRepository stepRequirementRepository,
            UserGroupRepository userGroupRepository,
            ReviewCycleRepository reviewCycleRepository) {
        this.productRepository = productRepository;
        this.workflowStepRepository = workflowStepRepository;
        this.stepRequirementRepository = stepRequirementRepository;
        this.userGroupRepository = userGroupRepository;
        this.reviewCycleRepository = reviewCycleRepository;
    }

    @Transactional(readOnly = true)
    public List<ProductDto> listProducts() {
        return productRepository.findAll().stream().map(this::loadProductDto).toList();
    }

    @Transactional(readOnly = true)
    public ProductDto getProduct(UUID id) {
        Product product = productRepository
                .findById(id)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, "Not found"));
        return loadProductDto(product);
    }

    @Transactional
    public ProductDto createProduct(ProductInputDto input) {
        ProductWorkflowValidator.validate(input);
        ensureNameAvailable(input.name(), null);
        validateGroupIds(input);
        Product product = EntityFactory.create(Product.class);
        product.setId(UUID.randomUUID());
        product.setName(input.name());
        product.setApprovalLifetimeDays(input.approvalLifetimeDays());
        productRepository.save(product);
        persistWorkflow(product, input);
        return loadProductDto(product);
    }

    @Transactional
    public ProductDto replaceProduct(UUID id, ProductInputDto input) {
        Product product = productRepository
                .findById(id)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, "Not found"));
        if (reviewCycleRepository.existsByMaterial_Product_Id(id)) {
            throw new ApiException(
                    ErrorCode.PRODUCT_LOCKED,
                    HttpStatus.CONFLICT,
                    "Product cannot change after review started");
        }
        ProductWorkflowValidator.validate(input);
        ensureNameAvailable(input.name(), id);
        validateGroupIds(input);
        product.setName(input.name());
        product.setApprovalLifetimeDays(input.approvalLifetimeDays());
        deleteWorkflow(product.getId());
        persistWorkflow(product, input);
        return loadProductDto(product);
    }

    private void deleteWorkflow(UUID productId) {
        List<WorkflowStep> steps = workflowStepRepository.findByProductIdOrderByPositionAsc(productId);
        for (WorkflowStep step : steps) {
            stepRequirementRepository.deleteAll(stepRequirementRepository.findByStepId(step.getId()));
        }
        workflowStepRepository.deleteAll(steps);
    }

    private void persistWorkflow(Product product, ProductInputDto input) {
        List<com.clearpath.review.service.setup.SetupDtos.WorkflowStepInputDto> sorted = input.steps().stream()
                .sorted(Comparator.comparingInt(com.clearpath.review.service.setup.SetupDtos.WorkflowStepInputDto::position))
                .toList();
        for (var stepInput : sorted) {
            WorkflowStep step = EntityFactory.create(WorkflowStep.class);
            step.setId(UUID.randomUUID());
            step.setProduct(product);
            step.setPosition(stepInput.position());
            step.setName(stepInput.name());
            workflowStepRepository.save(step);
            for (var reqInput : stepInput.requirements()) {
                StepRequirement requirement = EntityFactory.create(StepRequirement.class);
                requirement.setId(UUID.randomUUID());
                requirement.setStep(step);
                requirement.setGroup(userGroupRepository.getReferenceById(reqInput.groupId()));
                requirement.setApprovalsRequired(reqInput.approvalsRequired());
                stepRequirementRepository.save(requirement);
            }
        }
    }

    private void validateGroupIds(ProductInputDto input) {
        for (var step : input.steps()) {
            for (var req : step.requirements()) {
                if (!userGroupRepository.existsById(req.groupId())) {
                    throw new ApiException(
                            ErrorCode.VALIDATION, HttpStatus.BAD_REQUEST, "Unknown group id: " + req.groupId());
                }
            }
        }
    }

    private ProductDto loadProductDto(Product product) {
        List<WorkflowStep> steps = workflowStepRepository.findByProductIdOrderByPositionAsc(product.getId());
        Map<UUID, String> groupNames = new HashMap<>();
        List<WorkflowStepDto> stepDtos = new ArrayList<>();
        for (WorkflowStep step : steps) {
            List<StepRequirement> requirements = stepRequirementRepository.findByStepId(step.getId());
            List<StepRequirementDto> requirementDtos = new ArrayList<>();
            for (StepRequirement requirement : requirements) {
                UUID groupId = requirement.getGroup().getId();
                String groupName = groupNames.computeIfAbsent(groupId, id -> userGroupRepository
                        .findById(id)
                        .map(UserGroup::getName)
                        .orElse(""));
                requirementDtos.add(new StepRequirementDto(
                        requirement.getId(), groupId, groupName, requirement.getApprovalsRequired()));
            }
            stepDtos.add(new WorkflowStepDto(step.getId(), step.getPosition(), step.getName(), requirementDtos));
        }
        return new ProductDto(product.getId(), product.getName(), product.getApprovalLifetimeDays(), stepDtos);
    }

    private void ensureNameAvailable(String name, UUID exceptProductId) {
        productRepository.findByName(name).ifPresent(existing -> {
            if (exceptProductId == null || !existing.getId().equals(exceptProductId)) {
                throw new ApiException(ErrorCode.VALIDATION, HttpStatus.BAD_REQUEST, "Product name already in use");
            }
        });
    }
}
