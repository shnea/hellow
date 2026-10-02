package kr.shnea.hellow.security;

import java.util.Map;
import org.springframework.dao.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiErrors {
  @ExceptionHandler(ResponseStatusException.class)
  ResponseEntity<?> status(ResponseStatusException e) {
    return ResponseEntity.status(e.getStatusCode())
        .body(Map.of("detail", e.getReason() == null ? "요청을 처리하지 못했습니다." : e.getReason()));
  }

  @ExceptionHandler({
    OptimisticLockingFailureException.class,
    DataIntegrityViolationException.class
  })
  ResponseEntity<?> conflict(Exception e) {
    return ResponseEntity.status(409).body(Map.of("detail", "다른 작업과 충돌했습니다. 최신 상태를 확인해 주세요."));
  }

  @ExceptionHandler(org.springframework.web.bind.MethodArgumentNotValidException.class)
  ResponseEntity<?> validation(Exception e) {
    return ResponseEntity.badRequest().body(Map.of("detail", "입력값을 확인해 주세요."));
  }
}
