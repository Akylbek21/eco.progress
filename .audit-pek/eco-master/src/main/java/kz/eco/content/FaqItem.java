package kz.eco.content;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class FaqItem {

    @Column(name = "question", length = 300)
    private String question;

    @Column(name = "answer", length = 2000)
    private String answer;

    protected FaqItem() {
    }

    public FaqItem(String question, String answer) {
        this.question = question;
        this.answer = answer;
    }

    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }
    public String getAnswer() { return answer; }
    public void setAnswer(String answer) { this.answer = answer; }
}
