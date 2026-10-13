package com.gymapp.module.payment.service;

public class IndianCurrencyUtils {

    private static final String[] UNITS = {
            "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
            "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
            "Seventeen", "Eighteen", "Nineteen"
    };

    private static final String[] TENS = {
            "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
    };

    public static String formatIndianCurrency(long amountPaise) {
        boolean negative = amountPaise < 0;
        long absPaise = Math.abs(amountPaise);
        long rupees = absPaise / 100;
        long paise = absPaise % 100;

        String s = Long.toString(rupees);
        StringBuilder sb = new StringBuilder();
        int len = s.length();
        if (len <= 3) {
            sb.append(s);
        } else {
            String lastThree = s.substring(len - 3);
            String rest = s.substring(0, len - 3);
            StringBuilder restFormatted = new StringBuilder();
            int count = 0;
            for (int i = rest.length() - 1; i >= 0; i--) {
                restFormatted.insert(0, rest.charAt(i));
                count++;
                if (count == 2 && i > 0) {
                    restFormatted.insert(0, ",");
                    count = 0;
                }
            }
            sb.append(restFormatted).append(",").append(lastThree);
        }
        sb.append(String.format(".%02d", paise));
        return (negative ? "-₹ " : "₹ ") + sb.toString();
    }

    public static String formatRupeesInWords(long amountPaise) {
        long absPaise = Math.abs(amountPaise);
        long rupees = absPaise / 100;
        long paise = absPaise % 100;

        if (rupees == 0 && paise == 0) {
            return "Zero Rupees Only";
        }

        StringBuilder words = new StringBuilder();

        long crore = rupees / 10000000;
        rupees %= 10000000;

        long lakh = rupees / 100000;
        rupees %= 100000;

        long thousand = rupees / 1000;
        rupees %= 1000;

        long hundred = rupees / 100;
        long remainder = rupees % 100;

        if (crore > 0) {
            words.append(convertTwoDigits(crore)).append(" Crore ");
        }
        if (lakh > 0) {
            words.append(convertTwoDigits(lakh)).append(" Lakh ");
        }
        if (thousand > 0) {
            words.append(convertTwoDigits(thousand)).append(" Thousand ");
        }
        if (hundred > 0) {
            words.append(convertTwoDigits(hundred)).append(" Hundred ");
        }
        if (remainder > 0) {
            words.append(convertTwoDigits(remainder)).append(" ");
        }

        if (words.length() > 0) {
            words.append("Rupees");
        }

        if (paise > 0) {
            if (words.length() > 0) {
                words.append(" and ");
            }
            words.append(convertTwoDigits(paise)).append(" Paise");
        }

        words.append(" Only");

        return words.toString().trim().replaceAll("\\s+", " ");
    }

    private static String convertTwoDigits(long n) {
        if (n == 0) {
            return "";
        }
        if (n < 20) {
            return UNITS[(int) n];
        }
        int ten = (int) (n / 10);
        int unit = (int) (n % 10);
        return TENS[ten] + (unit > 0 ? " " + UNITS[unit] : "");
    }
}
