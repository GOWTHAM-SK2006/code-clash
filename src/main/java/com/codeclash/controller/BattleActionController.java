package com.codeclash.controller;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

@Controller
public class BattleActionController {

    @MessageMapping("/battle/{id}/sync")
    @SendTo("/topic/battle/{id}/code")
    public CodeSyncMessage syncCode(@DestinationVariable Long id, CodeSyncMessage message) {
        // Broadcast code changes to all members of the team (or everyone in battle)
        return message;
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
