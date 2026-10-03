package kr.shnea.hellow;

import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;

/** Run the same manual fixtures against a migrated, isolated PostgreSQL schema.
 * This opt-in test deletes fixture rows; never point it at a service database. */
@EnabledIfEnvironmentVariable(named="HELLOW_REPORTING_POSTGRES_TEST",matches="true")
@SpringBootTest(properties={
  "spring.datasource.url=${HELLOW_REPORTING_TEST_URL}",
  "spring.datasource.driver-class-name=org.postgresql.Driver",
  "spring.datasource.username=reporting",
  "spring.datasource.password=reporting_fixture_password",
  "spring.datasource.hikari.connection-init-sql=SET TIME ZONE 'Asia/Seoul'",
  "spring.flyway.enabled=false","spring.jpa.hibernate.ddl-auto=validate"})
@AutoConfigureMockMvc
class ReportingPostgresIntegrationTest extends ReportingIntegrationTest {
  @Override @BeforeEach void setup() {
    if (!"jdbc:postgresql://hellow-reporting-db:5432/reporting_fixture".equals(System.getenv("HELLOW_REPORTING_TEST_URL"))) {
      throw new IllegalStateException("Reporting fixtures require the dedicated isolated reporting_fixture database");
    }
    super.setup();
  }
}
