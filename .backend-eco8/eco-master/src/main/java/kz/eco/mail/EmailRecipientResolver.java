package kz.eco.mail;

import kz.eco.client.Client;
import kz.eco.order.Order;
import kz.eco.user.User;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Component
public class EmailRecipientResolver {

    public String clientEmail(Order order) {
        if (order == null) return null;
        Client client = order.getClient();
        if (client != null && client.getEmail() != null && !client.getEmail().isBlank()) {
            return client.getEmail();
        }
        if (client != null && client.getUser() != null) {
            return client.getUser().getEmail();
        }
        return null;
    }

    public List<String> staffEmails(Order order) {
        Set<String> emails = new LinkedHashSet<>();
        addUserEmail(emails, order.getManager());
        addUserEmail(emails, order.getAccountant());
        addUserEmail(emails, order.getEcologist());
        addUserEmail(emails, order.getLaboratoryUser());
        return new ArrayList<>(emails);
    }

    public List<String> managerAndAccountantEmails(Order order) {
        Set<String> emails = new LinkedHashSet<>();
        addUserEmail(emails, order.getManager());
        addUserEmail(emails, order.getAccountant());
        return new ArrayList<>(emails);
    }

    private void addUserEmail(Set<String> emails, User user) {
        if (user != null && user.getEmail() != null && !user.getEmail().isBlank()) {
            emails.add(user.getEmail().trim().toLowerCase());
        }
    }
}
