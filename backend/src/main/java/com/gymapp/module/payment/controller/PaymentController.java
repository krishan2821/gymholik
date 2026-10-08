package com.gymapp.module.payment.controller;

import com.gymapp.common.ApiResponse;
import com.gymapp.common.PagedResponse;
import com.gymapp.module.payment.dto.CreatePaymentRequest;
import com.gymapp.module.payment.dto.MemberDueResponse;
import com.gymapp.module.payment.dto.PaymentResponse;
import com.gymapp.module.payment.dto.PaymentListResponse;
import com.gymapp.module.payment.entity.Payment;

import com.gymapp.module.payment.service.PaymentService;
import com.gymapp.module.payment.service.ReceiptPdfService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Tag(name = "Payments", description = "Payment and Dues management")
@SecurityRequirement(name = "bearerAuth")
public class PaymentController {

    private final PaymentService paymentService;
    private final ReceiptPdfService receiptPdfService;

    @PostMapping("/payments")
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF')")
    @Operation(summary = "Record a payment")
    public ResponseEntity<ApiResponse<PaymentResponse>> createPayment(
            @Valid @RequestBody CreatePaymentRequest request) {
        PaymentResponse response = paymentService.createPayment(request);
        return ResponseEntity.ok(ApiResponse.success("Payment recorded successfully", response));
    }

    @GetMapping("/payments")
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF')")
    @Operation(summary = "Get paginated payments with optional date and mode filters")
    public ResponseEntity<ApiResponse<PaymentListResponse>> getPayments(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String mode,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
            
        PaymentListResponse response = paymentService.getPayments(
                startDate, endDate, mode, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(ApiResponse.success("Payments fetched successfully", response));
    }

    @GetMapping({"/dues", "/payments/dues"})
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF')")
    @Operation(summary = "Get list of members with pending dues")
    public ResponseEntity<ApiResponse<PagedResponse<MemberDueResponse>>> getDues(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PagedResponse<MemberDueResponse> dues = paymentService.getDues(PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.success("Dues fetched successfully", dues));
    }

    @PostMapping("/payments/{id}/reverse")
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "Reverse a payment (OWNER only)")
    public ResponseEntity<ApiResponse<PaymentResponse>> reversePayment(
            @PathVariable String id,
            @RequestParam(required = false) String notes) {
        PaymentResponse response = paymentService.reversePayment(id, notes);
        return ResponseEntity.ok(ApiResponse.success("Payment reversed successfully", response));
    }

    @GetMapping("/payments/{id}/receipt")
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF')")
    @Operation(summary = "Download payment receipt as PDF")
    public ResponseEntity<byte[]> getReceiptPdf(@PathVariable String id) {
        Payment payment = paymentService.getPaymentEntityById(id);
        byte[] pdfBytes = receiptPdfService.generateReceiptPdf(payment);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("attachment", "Receipt_" + payment.getReceiptNo() + ".pdf");
        headers.setCacheControl("must-revalidate, post-check=0, pre-check=0");

        return ResponseEntity.ok()
                .headers(headers)
                .body(pdfBytes);
    }
}
