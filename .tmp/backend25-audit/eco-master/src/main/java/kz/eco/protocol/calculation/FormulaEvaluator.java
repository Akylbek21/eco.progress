package kz.eco.protocol.calculation;

import kz.eco.common.exception.BadRequestException;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.Map;

@Component
public class FormulaEvaluator {

    public BigDecimal evaluate(String formulaExpression, Map<String, BigDecimal> variables,
                               int decimalPlaces, RoundingMode roundingMode) {
        if (formulaExpression == null || formulaExpression.isBlank()) {
            throw new BadRequestException("Формула расчёта не задана");
        }
        String expr = substituteVariables(formulaExpression, variables);
        try {
            BigDecimal result = parseExpression(expr, 0).value;
            return result.setScale(decimalPlaces, roundingMode);
        } catch (BadRequestException e) {
            throw e;
        } catch (Exception e) {
            throw new BadRequestException("Ошибка вычисления формулы: " + e.getMessage());
        }
    }

    private String substituteVariables(String formula, Map<String, BigDecimal> variables) {
        String result = formula;
        for (var entry : variables.entrySet()) {
            if (entry.getValue() == null) {
                throw new BadRequestException("Переменная '" + entry.getKey() + "' не задана");
            }
            result = result.replace(entry.getKey(), entry.getValue().toPlainString());
        }
        if (result.matches(".*[a-zA-Z_][a-zA-Z0-9_]*.*")) {
            String remaining = result.replaceAll("(sqrt|pow|min|max|abs)", "");
            if (remaining.matches(".*[a-zA-Z_][a-zA-Z0-9_]*.*")) {
                throw new BadRequestException("Не все переменные подставлены в формулу: " + formula);
            }
        }
        return result;
    }

    private record ParseResult(BigDecimal value, int pos) {}

    private ParseResult parseExpression(String expr, int pos) {
        ParseResult left = parseTerm(expr, pos);
        BigDecimal result = left.value;
        int p = left.pos;

        while (p < expr.length()) {
            char c = expr.charAt(p);
            if (c == '+') {
                ParseResult right = parseTerm(expr, p + 1);
                result = result.add(right.value);
                p = right.pos;
            } else if (c == '-') {
                ParseResult right = parseTerm(expr, p + 1);
                result = result.subtract(right.value);
                p = right.pos;
            } else {
                break;
            }
        }
        return new ParseResult(result, p);
    }

    private ParseResult parseTerm(String expr, int pos) {
        ParseResult left = parseFactor(expr, skipSpaces(expr, pos));
        BigDecimal result = left.value;
        int p = left.pos;

        while (p < expr.length()) {
            p = skipSpaces(expr, p);
            if (p >= expr.length()) break;
            char c = expr.charAt(p);
            if (c == '*') {
                ParseResult right = parseFactor(expr, skipSpaces(expr, p + 1));
                result = result.multiply(right.value, MathContext.DECIMAL128);
                p = right.pos;
            } else if (c == '/') {
                ParseResult right = parseFactor(expr, skipSpaces(expr, p + 1));
                if (right.value.compareTo(BigDecimal.ZERO) == 0) {
                    throw new BadRequestException("Деление на ноль в формуле");
                }
                result = result.divide(right.value, 10, RoundingMode.HALF_UP);
                p = right.pos;
            } else {
                break;
            }
        }
        return new ParseResult(result, p);
    }

    private ParseResult parseFactor(String expr, int pos) {
        pos = skipSpaces(expr, pos);
        if (pos >= expr.length()) {
            throw new BadRequestException("Неожиданный конец формулы");
        }

        if (expr.startsWith("sqrt(", pos)) {
            return parseFunction("sqrt", expr, pos + 5);
        }
        if (expr.startsWith("pow(", pos)) {
            return parsePowFunction(expr, pos + 4);
        }
        if (expr.startsWith("min(", pos)) {
            return parseMinMax("min", expr, pos + 4);
        }
        if (expr.startsWith("max(", pos)) {
            return parseMinMax("max", expr, pos + 4);
        }
        if (expr.startsWith("abs(", pos)) {
            return parseFunction("abs", expr, pos + 4);
        }

        char c = expr.charAt(pos);
        if (c == '(') {
            ParseResult inner = parseExpression(expr, pos + 1);
            int p = skipSpaces(expr, inner.pos);
            if (p < expr.length() && expr.charAt(p) == ')') p++;
            return new ParseResult(inner.value, p);
        }
        if (c == '-') {
            ParseResult inner = parseFactor(expr, pos + 1);
            return new ParseResult(inner.value.negate(), inner.pos);
        }

        return parseNumber(expr, pos);
    }

    private ParseResult parseFunction(String name, String expr, int pos) {
        ParseResult arg = parseExpression(expr, pos);
        int p = skipSpaces(expr, arg.pos);
        if (p < expr.length() && expr.charAt(p) == ')') p++;
        BigDecimal result = switch (name) {
            case "sqrt" -> BigDecimal.valueOf(Math.sqrt(arg.value.doubleValue()));
            case "abs" -> arg.value.abs();
            default -> throw new BadRequestException("Неизвестная функция: " + name);
        };
        return new ParseResult(result, p);
    }

    private ParseResult parsePowFunction(String expr, int pos) {
        ParseResult base = parseExpression(expr, pos);
        int p = skipSpaces(expr, base.pos);
        if (p < expr.length() && expr.charAt(p) == ',') p++;
        ParseResult exp = parseExpression(expr, p);
        p = skipSpaces(expr, exp.pos);
        if (p < expr.length() && expr.charAt(p) == ')') p++;
        BigDecimal result = BigDecimal.valueOf(Math.pow(base.value.doubleValue(), exp.value.doubleValue()));
        return new ParseResult(result, p);
    }

    private ParseResult parseMinMax(String name, String expr, int pos) {
        ParseResult first = parseExpression(expr, pos);
        int p = skipSpaces(expr, first.pos);
        if (p < expr.length() && expr.charAt(p) == ',') p++;
        ParseResult second = parseExpression(expr, p);
        p = skipSpaces(expr, second.pos);
        if (p < expr.length() && expr.charAt(p) == ')') p++;
        BigDecimal result = "min".equals(name)
                ? first.value.min(second.value)
                : first.value.max(second.value);
        return new ParseResult(result, p);
    }

    private ParseResult parseNumber(String expr, int pos) {
        int start = pos;
        while (pos < expr.length() && (Character.isDigit(expr.charAt(pos)) || expr.charAt(pos) == '.')) {
            pos++;
        }
        if (pos == start) {
            throw new BadRequestException("Ожидалось число в позиции " + pos + " формулы: " + expr);
        }
        return new ParseResult(new BigDecimal(expr.substring(start, pos)), pos);
    }

    private int skipSpaces(String expr, int pos) {
        while (pos < expr.length() && expr.charAt(pos) == ' ') pos++;
        return pos;
    }
}
