package com.codeclash.controller;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

@Controller
@AllArgsConstructor
public class BattleActionController {

    private final org.springframework.messaging.simp.SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/battle/{id}/sync")
    public void syncCode(@DestinationVariable Long id, CodeSyncMessage message) {
        // Broadcast code changes ONLY to members of the same team
        String topic = "/topic/battle/" + id + "/team/" + message.getTeamId() + "/code";
        messagingTemplate.convertAndSend(topic, message);
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CodeSyncMessage {
        private String sender;
        private String code;
        private String language;
        private Long teamId;
    }
}
