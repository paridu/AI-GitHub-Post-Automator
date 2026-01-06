
export class FacebookService {
  /**
   * Posts content to a Facebook Page feed.
   */
  static async postToPage(pageId: string, accessToken: string, message: string, link: string) {
    if (!pageId || !accessToken) {
      throw new Error("ไม่พบข้อมูล Facebook Page ID หรือ Access Token");
    }

    const url = `https://graph.facebook.com/v21.0/${pageId}/feed`;
    const params = new URLSearchParams({
      message: message,
      link: link,
      access_token: accessToken,
    });

    try {
      const response = await fetch(`${url}?${params.toString()}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle common Facebook API errors
        const errorMsg = data.error?.message || "ไม่สามารถโพสต์ไปยัง Facebook ได้";
        if (data.error?.code === 190) throw new Error("Access Token หมดอายุหรือเซสชันสิ้นสุดลง โปรดล็อกอินใหม่");
        if (data.error?.code === 200) throw new Error("ไม่มีสิทธิ์ในการโพสต์ (Permissions error)");
        throw new Error(errorMsg);
      }

      return data.id;
    } catch (err: any) {
      throw new Error(err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อกับ Facebook API");
    }
  }

  /**
   * Verifies if the current configuration is valid (Simulated)
   */
  static async verifyConnection(pageId: string, accessToken: string): Promise<boolean> {
    if (!pageId || !accessToken) return false;
    // In real app: fetch(`https://graph.facebook.com/me?access_token=${accessToken}`)
    return accessToken.length > 10 && pageId.length > 5;
  }

  /**
   * Simulated Facebook Login
   */
  static async simulateLogin(): Promise<{ accessToken: string; pageId: string }> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Randomly simulate success for demo
        if (Math.random() > 0.05) {
          resolve({
            accessToken: "EAAb" + Math.random().toString(36).substring(2, 15),
            pageId: "1029" + Math.floor(Math.random() * 999999)
          });
        } else {
          reject(new Error("Login failed by user or service provider"));
        }
      }, 1500);
    });
  }
}
