package com.codeclash.service;

import com.codeclash.entity.QueryMessage;
import com.codeclash.entity.SupportQuery;
import com.codeclash.entity.User;
import com.codeclash.repository.QueryMessageRepository;
import com.codeclash.repository.SupportQueryRepository;
import com.codeclash.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SupportQueryService {

    private final SupportQueryRepository queryRepository;
    private final QueryMessageRepository messageRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    @Transactional
    public SupportQuery createQuery(User user, String subject, String content) {
        SupportQuery query = SupportQuery.builder()
                .user(user)
                .subject(subject)
                .status("OPEN")
                .build();
        query = queryRepository.save(query);

        QueryMessage message = QueryMessage.builder()
                .query(query)
                .sender(user)
                .content(content)
                .build();
        messageRepository.save(message);

        return query;
    }

    public List<SupportQuery> getMyQueries(User user) {
        return queryRepository.findByUserOrderByUpdatedAtDesc(user);
    }

    public List<SupportQuery> getAllQueries() {
        return queryRepository.findAllByOrderByUpdatedAtDesc();
    }

    public List<QueryMessage> getMessages(Long queryId, User user) {
        SupportQuery query = queryRepository.findById(queryId)
                .orElseThrow(() -> new RuntimeException("Query not found"));
        
        // Ensure user is either the owner or an admin
        if (!query.getUser().getId().equals(user.getId()) && !user.getRole().equals("ADMIN")) {
            throw new RuntimeException("Unauthorized access to query");
        }

        return messageRepository.findByQueryOrderByCreatedAtAsc(query);
    }

    @Transactional
    public QueryMessage addMessage(Long queryId, User sender, String content) {
        SupportQuery query = queryRepository.findById(queryId)
                .orElseThrow(() -> new RuntimeException("Query not found"));

        if (!query.getUser().getId().equals(sender.getId()) && !sender.getRole().equals("ADMIN")) {
            throw new RuntimeException("Unauthorized access to query");
        }

        QueryMessage message = QueryMessage.builder()
                .query(query)
                .sender(sender)
                .content(content)
                .build();
        
        // Update query timestamp
        query.setStatus("OPEN"); // Re-open if closed and someone replies? Or keep as is?
        queryRepository.save(query);

        message = messageRepository.save(message);

        // Notify user if admin replied
        if (sender.getRole().equals("ADMIN") && !query.getUser().getId().equals(sender.getId())) {
            notificationService.sendNotification(
                query.getUser(),
                "QUERY_REPLY",
                "New Reply to Your Query",
                "Administrator has replied to: " + query.getSubject(),
                "messages.html?id=" + query.getId()
            );
        }

        return message;
    }

    @Transactional
    public void resolveQuery(Long queryId) {
        SupportQuery query = queryRepository.findById(queryId)
                .orElseThrow(() -> new RuntimeException("Query not found"));
        query.setStatus("RESOLVED");
        queryRepository.save(query);
    }
}
