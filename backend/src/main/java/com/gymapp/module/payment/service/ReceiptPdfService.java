package com.gymapp.module.payment.service;

import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.auth.entity.Gym;
import com.gymapp.module.auth.repository.GymRepository;
import com.gymapp.module.member.entity.Member;
import com.gymapp.module.member.repository.MemberRepository;
import com.gymapp.module.payment.entity.Payment;
import com.lowagie.text.Document;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.PdfWriter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.text.NumberFormat;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class ReceiptPdfService {

    private final GymRepository gymRepository;
    private final MemberRepository memberRepository;

    public byte[] generateReceiptPdf(Payment payment) {
        Gym gym = gymRepository.findById(payment.getGymId())
                .orElseThrow(() -> new AppException(ErrorCode.GYM_NOT_FOUND));

        Member member = memberRepository.findByIdAndGymId(payment.getMemberId(), payment.getGymId())
                .orElseThrow(() -> new AppException(ErrorCode.MEMBER_NOT_FOUND));

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            Document document = new Document();
            PdfWriter.getInstance(document, baos);

            document.open();

            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 24);
            Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14);
            Font normalFont = FontFactory.getFont(FontFactory.HELVETICA, 12);

            // Gym Name
            Paragraph gymName = new Paragraph(gym.getName(), titleFont);
            gymName.setAlignment(Paragraph.ALIGN_CENTER);
            document.add(gymName);

            // Receipt Title
            Paragraph receiptTitle = new Paragraph("PAYMENT RECEIPT", headerFont);
            receiptTitle.setAlignment(Paragraph.ALIGN_CENTER);
            receiptTitle.setSpacingAfter(20);
            document.add(receiptTitle);

            // Receipt Details
            document.add(new Paragraph("Receipt No: " + payment.getReceiptNo(), normalFont));
            document.add(new Paragraph("Date: " + payment.getPaidAt().toLocalDate().format(DateTimeFormatter.ISO_DATE), normalFont));
            
            document.add(new Paragraph(" ", normalFont)); // empty line
            
            document.add(new Paragraph("Member: " + member.getName() + " (" + member.getMemberCode() + ")", normalFont));
            
            String formattedAmount = NumberFormat.getCurrencyInstance(new Locale("en", "IN"))
                    .format(payment.getAmountPaise() / 100.0);
            document.add(new Paragraph("Amount Paid: " + formattedAmount, headerFont));
            
            document.add(new Paragraph("Payment Mode: " + payment.getMode(), normalFont));

            if ("REVERSAL".equals(payment.getType())) {
                Paragraph reversalNote = new Paragraph("NOTE: THIS IS A REVERSAL RECEIPT", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12));
                document.add(reversalNote);
            }

            if (payment.getReason() != null && !payment.getReason().isEmpty()) {
                document.add(new Paragraph("Notes: " + payment.getReason(), normalFont));
            }

            document.close();
            return baos.toByteArray();

        } catch (Exception e) {
            throw new AppException(ErrorCode.INTERNAL_ERROR, "Failed to generate receipt PDF");
        }
    }
}
