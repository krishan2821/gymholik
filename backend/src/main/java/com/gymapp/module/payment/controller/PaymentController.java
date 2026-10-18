package com.gymapp.module.payment.controller;

import com.gymapp.common.ApiResponse;
import com.gymapp.module.payment.dto.*;
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

import org.springframework.util.StringUtils;
import java.time.LocalDate;

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
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyHeader,
            @Valid @RequestBody CreatePaymentRequest request) {
        if (StringUtils.hasText(idempotencyHeader) && !StringUtils.hasText(request.getIdempotencyKey())) {
            request.setIdempotencyKey(idempotencyHeader.trim());
        }
        PaymentResponse response = paymentService.createPayment(request);
        return ResponseEntity.ok(ApiResponse.success("Payment recorded successfully", response));
    }

    @GetMapping("/payments/summary")
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "Get payment summary by period (OWNER only)")
    public ResponseEntity<ApiResponse<PaymentSummaryResponse>> getPaymentSummary(
            @RequestParam(required = false, defaultValue = "MONTH") String period,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        PaymentSummaryResponse response = paymentService.getSummary(period, from, to);
        return ResponseEntity.ok(ApiResponse.success("Payment summary fetched successfully", response));
    }

    @GetMapping("/payments")
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF')")
    @Operation(summary = "Get paginated payments with optional period, date, mode, member, and search filters")
    public ResponseEntity<ApiResponse<PaymentListResponse>> getPayments(
            @RequestParam(required = false) String period,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String mode,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String memberId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
            
        PaymentListResponse response = paymentService.getPayments(
                period, startDate, endDate, mode, search, memberId,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "paidAt", "createdAt")));
        return ResponseEntity.ok(ApiResponse.success("Payments fetched successfully", response));
    }


    @GetMapping("/payments/{id}")
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF')")
    @Operation(summary = "Get payment detail by ID")
    public ResponseEntity<ApiResponse<PaymentDetailResponse>> getPaymentDetail(@PathVariable String id) {
        PaymentDetailResponse response = paymentService.getPaymentDetail(id);
        return ResponseEntity.ok(ApiResponse.success("Payment details fetched successfully", response));
    }

    @GetMapping({"/dues", "/payments/dues"})
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF')")
    @Operation(summary = "Get list of members with pending dues (ALL, OVERDUE, EXPIRING, PARTIAL)")
    public ResponseEntity<ApiResponse<DuesListResponse>> getDues(
            @RequestParam(required = false, defaultValue = "ALL") String filter,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        DuesListResponse dues = paymentService.getDues(filter, search, PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.success("Dues fetched successfully", dues));
    }

    @GetMapping({"/members/{id}/payment-context", "/payments/context"})
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF')")
    @Operation(summary = "Get payment context for member including pending membership dues")
    public ResponseEntity<ApiResponse<MemberPaymentContextResponse>> getPaymentContext(
            @PathVariable(value = "id", required = false) String pathMemberId,
            @RequestParam(value = "memberId", required = false) String queryMemberId) {
        String memberId = StringUtils.hasText(pathMemberId) ? pathMemberId : queryMemberId;
        MemberPaymentContextResponse response = paymentService.getPaymentContext(memberId);
        return ResponseEntity.ok(ApiResponse.success("Payment context fetched successfully", response));
    }

    @PostMapping("/payments/{id}/reverse")
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "Reverse a payment (OWNER only)")
    public ResponseEntity<ApiResponse<PaymentResponse>> reversePayment(
            @PathVariable String id,
            @RequestBody(required = false) @Valid ReversePaymentRequest request,
            @RequestParam(required = false) ReversalReasonCode reasonCode,
            @RequestParam(required = false) String note,
            @RequestParam(required = false) String notes) {
        if (request == null || (request.getReasonCode() == null && request.getNote() == null)) {
            request = new ReversePaymentRequest();
            request.setReasonCode(reasonCode != null ? reasonCode : (notes != null ? ReversalReasonCode.OTHER : null));
            request.setNote(note != null ? note : notes);
        }
        PaymentResponse response = paymentService.reversePayment(id, request);
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

    @GetMapping("/payments/day-close")
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "Get day-close summary report")
    public ResponseEntity<ApiResponse<DayCloseReportResponse>> getDayCloseReport(
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) LocalDate date) {
        DayCloseReportResponse response = paymentService.getDayCloseReport(date);
        return ResponseEntity.ok(ApiResponse.success("Day close report retrieved successfully", response));
    }

    @PostMapping("/payments/day-close")
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "Submit and save day-close for cash drawer reconciliation")
    public ResponseEntity<ApiResponse<com.gymapp.module.payment.entity.DayClose>> submitDayClose(
            @jakarta.validation.Valid @RequestBody SubmitDayCloseRequest request) {
        com.gymapp.module.payment.entity.DayClose response = paymentService.submitDayClose(request);
        return ResponseEntity.ok(ApiResponse.success("Day close submitted successfully", response));
    }
}
