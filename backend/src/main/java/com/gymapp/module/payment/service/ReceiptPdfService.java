package com.gymapp.module.payment.service;

import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.auth.entity.Gym;
import com.gymapp.module.auth.entity.GymAddress;
import com.gymapp.module.auth.entity.LegalIdType;
import com.gymapp.module.auth.entity.User;
import com.gymapp.module.auth.repository.GymRepository;
import com.gymapp.module.auth.repository.UserRepository;
import com.gymapp.module.member.entity.Member;
import com.gymapp.module.member.entity.Membership;
import com.gymapp.module.member.repository.MemberRepository;
import com.gymapp.module.member.repository.MembershipRepository;
import com.gymapp.module.payment.entity.Payment;
import com.gymapp.module.payment.repository.PaymentRepository;
import com.gymapp.security.SecurityUtils;
import com.lowagie.text.*;
import com.lowagie.text.pdf.BaseFont;
import com.lowagie.text.pdf.PdfWriter;
import com.lowagie.text.pdf.draw.LineSeparator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
public class ReceiptPdfService {

    private final GymRepository gymRepository;
    private final MemberRepository memberRepository;
    private final MembershipRepository membershipRepository;
    private final PaymentRepository paymentRepository;
    private final UserRepository userRepository;

    public byte[] generateReceiptPdf(Payment payment) {
        Gym gym = gymRepository.findById(payment.getGymId())
                .orElseThrow(() -> new AppException(ErrorCode.GYM_NOT_FOUND));

        Member member = memberRepository.findByIdAndGymId(payment.getMemberId(), payment.getGymId())
                .orElseThrow(() -> new AppException(ErrorCode.MEMBER_NOT_FOUND));

        Membership membership = null;
        if (StringUtils.hasText(payment.getMembershipId())) {
            membership = membershipRepository.findByIdAndGymId(payment.getMembershipId(), payment.getGymId())
                    .orElse(null);
        }

        boolean isReversal = "REVERSAL".equalsIgnoreCase(payment.getType()) || payment.getReversalOfId() != null;

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            Document document = new Document(PageSize.A4, 36, 36, 36, 36);
            PdfWriter.getInstance(document, baos);
            document.open();

            Font titleFont = getFont(20, Font.BOLD);
            Font subtitleFont = getFont(14, Font.BOLD);
            Font sectionFont = getFont(12, Font.BOLD);
            Font normalFont = getFont(10, Font.NORMAL);
            Font boldFont = getFont(10, Font.BOLD);
            Font italicFont = getFont(9, Font.ITALIC);

            // 1. Gym Name
            Paragraph gymName = new Paragraph(gym.getName(), titleFont);
            gymName.setAlignment(Element.ALIGN_CENTER);
            document.add(gymName);

            // 2. Gym Address
            if (gym.getAddress() != null) {
                Paragraph addr = new Paragraph(formatAddress(gym.getAddress()), normalFont);
                addr.setAlignment(Element.ALIGN_CENTER);
                document.add(addr);
            }

            // 3. Gym phone only if owner is viewing
            if (SecurityUtils.isOwner() && StringUtils.hasText(gym.getPhone())) {
                Paragraph phone = new Paragraph("Phone: " + gym.getPhone(), normalFont);
                phone.setAlignment(Element.ALIGN_CENTER);
                document.add(phone);
            }

            // 4. Optional GSTIN line only if gym has legal id of type GSTIN
            if (LegalIdType.GSTIN == gym.getLegalIdType() && StringUtils.hasText(gym.getLegalIdNumber())) {
                Paragraph gstin = new Paragraph("GSTIN: " + gym.getLegalIdNumber(), normalFont);
                gstin.setAlignment(Element.ALIGN_CENTER);
                document.add(gstin);
            }

            document.add(new Paragraph(" ", normalFont));

            // Receipt Header / Title
            String titleText = isReversal ? "REVERSAL RECEIPT" : "PAYMENT RECEIPT";
            Paragraph receiptTitle = new Paragraph(titleText, subtitleFont);
            receiptTitle.setAlignment(Element.ALIGN_CENTER);
            receiptTitle.setSpacingAfter(10);
            document.add(receiptTitle);

            LineSeparator line = new LineSeparator(0.5f, 100, null, Element.ALIGN_CENTER, -2);
            document.add(line);
            document.add(new Paragraph(" ", normalFont));

            // 5. Receipt Details
            document.add(new Paragraph("Receipt Number: " + payment.getReceiptNo(), boldFont));

            if (isReversal && StringUtils.hasText(payment.getReversalOfId())) {
                Payment orig = paymentRepository.findByIdAndGymId(payment.getReversalOfId(), gym.getId()).orElse(null);
                String origReceipt = orig != null ? orig.getReceiptNo() : payment.getReversalOfId();
                document.add(new Paragraph("Original Receipt No: " + origReceipt, normalFont));
            }

            LocalDateTime dt = payment.getPaidAt() != null ? payment.getPaidAt() : payment.getCreatedAt();
            String dateTimeStr = dt != null ? dt.format(DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm:ss")) : "-";
            document.add(new Paragraph("Date & Time: " + dateTimeStr, normalFont));

            document.add(new Paragraph(" ", normalFont));

            // 6. Member Details (NO phone number!)
            document.add(new Paragraph("Member Name: " + member.getName(), normalFont));
            document.add(new Paragraph("Member Code: " + member.getMemberCode(), normalFont));

            // 7. Plan Details
            String planName = membership != null ? membership.getPlanName() : "-";
            String period = (membership != null && membership.getStartDate() != null && membership.getExpiryDate() != null)
                    ? membership.getStartDate() + " to " + membership.getExpiryDate() : "-";
            document.add(new Paragraph("Plan Name: " + planName, normalFont));
            document.add(new Paragraph("Plan Period: " + period, normalFont));

            String validTill = (membership != null && membership.getExpiryDate() != null)
                    ? membership.getExpiryDate().toString() : "-";
            document.add(new Paragraph("Membership Valid Till: " + validTill, normalFont));

            document.add(new Paragraph(" ", normalFont));

            // 8. Financial Details
            String formattedAmount = IndianCurrencyUtils.formatIndianCurrency(payment.getAmountPaise());
            String wordsAmount = IndianCurrencyUtils.formatRupeesInWords(payment.getAmountPaise());

            document.add(new Paragraph("Amount Paid: " + formattedAmount, sectionFont));
            document.add(new Paragraph("Amount in Words: " + wordsAmount, normalFont));
            document.add(new Paragraph("Payment Mode: " + payment.getMode(), normalFont));

            String refNo = StringUtils.hasText(payment.getReferenceNo()) ? payment.getReferenceNo() : payment.getReceiptNo();
            document.add(new Paragraph("Reference Number: " + refNo, normalFont));

            long balanceDuePaise = membership != null ? membership.getDuePaise() : 0L;
            document.add(new Paragraph("Balance Due: " + IndianCurrencyUtils.formatIndianCurrency(balanceDuePaise), normalFont));

            // 9. Received by staff first name
            String staffFirstName = "Staff";
            if (StringUtils.hasText(payment.getReceivedBy())) {
                User staffUser = userRepository.findById(payment.getReceivedBy()).orElse(null);
                if (staffUser != null && StringUtils.hasText(staffUser.getName())) {
                    staffFirstName = staffUser.getName().trim().split("\\s+")[0];
                }
            }
            document.add(new Paragraph("Received by: " + staffFirstName, normalFont));

            if (StringUtils.hasText(payment.getNote())) {
                document.add(new Paragraph("Note: " + payment.getNote(), normalFont));
            } else if (StringUtils.hasText(payment.getReason())) {
                document.add(new Paragraph("Note: " + payment.getReason(), normalFont));
            }

            document.add(new Paragraph(" ", normalFont));
            document.add(line);
            document.add(new Paragraph(" ", normalFont));

            // 10. Footer
            Paragraph footer = new Paragraph("This is a payment receipt, not a tax invoice", italicFont);
            footer.setAlignment(Element.ALIGN_CENTER);
            document.add(footer);

            document.close();
            return baos.toByteArray();

        } catch (Exception e) {
            throw new AppException(ErrorCode.INTERNAL_ERROR, "Failed to generate receipt PDF: " + e.getMessage());
        }
    }

    private Font getFont(float size, int style) {
        String[] fontPaths = {
                "/System/Library/Fonts/Supplemental/Georgia.ttf",
                "/Library/Fonts/Georgia.ttf",
                "/System/Library/Fonts/Supplemental/STIXTwoText.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
                "C:/Windows/Fonts/georgia.ttf"
        };
        for (String path : fontPaths) {
            File f = new File(path);
            if (f.exists()) {
                try {
                    BaseFont bf = BaseFont.createFont(path, BaseFont.IDENTITY_H, BaseFont.EMBEDDED);
                    if (bf.charExists(0x20B9)) {
                        return new Font(bf, size, style);
                    }
                } catch (Exception ignored) {}
            }
        }
        return FontFactory.getFont(FontFactory.HELVETICA, size, style);
    }

    private String formatAddress(GymAddress addr) {
        StringBuilder sb = new StringBuilder();
        if (StringUtils.hasText(addr.getLine1())) sb.append(addr.getLine1());
        if (StringUtils.hasText(addr.getLine2())) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(addr.getLine2());
        }
        if (StringUtils.hasText(addr.getDistrict())) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(addr.getDistrict());
        }
        if (StringUtils.hasText(addr.getState())) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(addr.getState());
        }
        if (StringUtils.hasText(addr.getPincode())) {
            if (sb.length() > 0) sb.append(" - ");
            sb.append(addr.getPincode());
        }
        return sb.toString();
    }
}
