package kr.shnea.hellow.security;

public enum DataScope {
  SELF, TEAM, ORGANIZATION;
  public static DataScope wider(DataScope a, DataScope b) { return a.ordinal() >= b.ordinal() ? a : b; }
}
