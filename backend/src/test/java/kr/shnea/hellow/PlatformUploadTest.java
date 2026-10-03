package kr.shnea.hellow;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.util.*;
import kr.shnea.hellow.platform.*;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PlatformUploadTest {
  @Test
  void resolvesRelativePlaybackCapabilitiesAgainstPlatformOrigin() throws Exception {
    var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/api/v1/files/audio/view-ticket", exchange -> {
      assertThat(exchange.getRequestHeaders().getFirst("X-Platform-Key")).isEqualTo("test-key");
      byte[] body = "{\"originalUrl\":\"/api/v1/files/audio/content/original?token=fixture\",\"downloadUrl\":\"https://cdn.example.test/audio\",\"previewUrl\":null,\"state\":\"READY\"}".getBytes(java.nio.charset.StandardCharsets.UTF_8);
      exchange.getResponseHeaders().set("Content-Type", "application/json");
      exchange.sendResponseHeaders(200, body.length);
      exchange.getResponseBody().write(body);
      exchange.close();
    });
    server.start();
    try {
      var origin = "http://127.0.0.1:" + server.getAddress().getPort();
      var properties = mock(PlatformProperties.class);
      when(properties.getApiUrl()).thenReturn(origin);
      when(properties.getApiKey()).thenReturn("test-key");
      var result = new PlatformClient(properties).getViewTicket("audio");
      assertThat(result.get("originalUrl")).isEqualTo(origin + "/api/v1/files/audio/content/original?token=fixture");
      assertThat(result.get("downloadUrl")).isEqualTo("https://cdn.example.test/audio");
      assertThat(result.get("previewUrl")).isNull();
      assertThat(result.get("state")).isEqualTo("READY");
    } finally { server.stop(0); }
  }

  @Test
  void resumesAcknowledgedBytesAndRecoversLostCompletionResponse() throws Exception {
    var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    var requests = new ArrayList<String>();
    var received = new ArrayList<byte[]>();
    var ready = new java.util.concurrent.atomic.AtomicBoolean(false);
    server.createContext("/api/v1/files/uploads", exchange -> {
      requests.add(exchange.getRequestMethod() + " " + exchange.getRequestURI().getPath());
      byte[] body = exchange.getRequestBody().readAllBytes();
      String result;
      if (exchange.getRequestMethod().equals("PATCH")) {
        requests.add("offset=" + exchange.getRequestHeaders().getFirst("Upload-Offset"));
        received.add(body);
        result = "{}";
      } else if (exchange.getRequestURI().getPath().endsWith("/complete")) {
        ready.set(true);
        result = "{\"fileId\":\"saved-audio\"}";
      } else result = ready.get()
          ? "{\"uploadId\":\"audio\",\"state\":\"READY\",\"size\":6,\"receivedBytes\":6,\"fileId\":\"saved-audio\"}"
          : "{\"uploadId\":\"audio\",\"state\":\"UPLOADING\",\"size\":6,\"receivedBytes\":3}";
      byte[] bytes = result.getBytes(java.nio.charset.StandardCharsets.UTF_8);
      exchange.getResponseHeaders().set("Content-Type", "application/json");
      exchange.sendResponseHeaders(200, bytes.length);
      exchange.getResponseBody().write(bytes);
      exchange.close();
    });
    server.start();
    var audio = java.nio.file.Files.createTempFile("recording-resume-", ".ogg");
    try {
      java.nio.file.Files.write(audio, new byte[]{1, 2, 3, 4, 5, 6});
      var properties = mock(PlatformProperties.class);
      when(properties.getApiUrl()).thenReturn("http://127.0.0.1:" + server.getAddress().getPort());
      when(properties.isConfigured()).thenReturn(true);
      when(properties.getApiKey()).thenReturn("test-key");
      when(properties.getAttachmentRetentionCode()).thenReturn("test-policy");
      var client = new PlatformClient(properties);
      assertThat(client.uploadFile(audio, "same-request").fileId()).isEqualTo("saved-audio");
      assertThat(received).hasSize(1);
      assertThat(received.getFirst()).containsExactly(4, 5, 6);
      assertThat(requests).contains("offset=3");
      requests.clear();
      assertThat(client.uploadFile(audio, "same-request").fileId()).isEqualTo("saved-audio");
      assertThat(requests).containsExactly("POST /api/v1/files/uploads");
    } finally {
      server.stop(0);
      java.nio.file.Files.deleteIfExists(audio);
    }
  }

  @Test
  void streamsPrivateFileInBoundedChunksWithoutGetBytes() throws Exception {
    var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    var lengths = new ArrayList<Integer>();
    var offsets = new ArrayList<String>();
    var creates = new ArrayList<String>();
    server.createContext(
        "/api/v1/files/uploads",
        exchange -> {
          byte[] body = exchange.getRequestBody().readAllBytes();
          String result;
          if (exchange.getRequestMethod().equals("PATCH")) {
            lengths.add(body.length);
            offsets.add(exchange.getRequestHeaders().getFirst("Upload-Offset"));
            result = "{}";
          } else if (exchange.getRequestURI().getPath().endsWith("/complete"))
            result = "{\"fileId\":\"file-test\"}";
          else {
            creates.add(new String(body, java.nio.charset.StandardCharsets.UTF_8));
            result = "{\"uploadId\":\"upload-test\"}";
          }
          byte[] bytes = result.getBytes(java.nio.charset.StandardCharsets.UTF_8);
          exchange.getResponseHeaders().set("Content-Type", "application/json");
          exchange.sendResponseHeaders(200, bytes.length);
          exchange.getResponseBody().write(bytes);
          exchange.close();
        });
    server.start();
    try {
      var properties = mock(PlatformProperties.class);
      when(properties.getApiUrl()).thenReturn("http://127.0.0.1:" + server.getAddress().getPort());
      when(properties.isConfigured()).thenReturn(true);
      when(properties.getApiKey()).thenReturn("test-key");
      when(properties.getAttachmentRetentionCode()).thenReturn("test-policy");
      byte[] bytes = new byte[9 * 1024 * 1024];
      Arrays.fill(bytes, (byte) 7);
      var file =
          new MockMultipartFile("file", "test.bin", "application/octet-stream", bytes) {
            @Override
            public byte[] getBytes() {
              throw new AssertionError("Whole-file buffer is forbidden");
            }
          };
      var result = new PlatformClient(properties).uploadFile(file, "stable-request");
      assertThat(result.fileId()).isEqualTo("file-test");
      assertThat(lengths).containsExactly(8 * 1024 * 1024, 1024 * 1024);
      assertThat(offsets).containsExactly("0", String.valueOf(8 * 1024 * 1024));
      assertThat(creates.getFirst()).contains("PRIVATE", "test-policy", "stable-request");
    } finally {
      server.stop(0);
    }
  }
}
