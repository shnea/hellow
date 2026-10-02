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
