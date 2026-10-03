package kr.shnea.hellow.customer;

/** Formatting is ignored for lookup; country codes are never guessed. */
public final class PhoneNumbers {
  private PhoneNumbers() {}
  public static String key(String phone) {return phone==null?"":phone.replaceAll("[^0-9]","");}
}
