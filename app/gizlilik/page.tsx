import type { Metadata } from "next";

import { brandConfig } from "@/lib/config/brand";

export const metadata: Metadata = {
  title: `Gizlilik Politikası · ${brandConfig.productName}`,
};

/**
 * Public privacy policy — required by Meta before an app can switch to Live
 * mode, and linked from App Settings → Basic. Plain server-rendered page.
 */
export default function GizlilikPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-[15px] leading-relaxed text-foreground">
      <h1 className="text-2xl font-semibold">Gizlilik Politikası</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Son güncelleme: 4 Ağustos 2026
      </p>

      <section className="mt-8 space-y-6">
        <div>
          <h2 className="font-semibold">1. Kimiz?</h2>
          <p className="mt-1.5 text-muted-foreground">
            {brandConfig.productName}, e-ticaret mağazalarının müşteri
            mesajlarını yapay zekâ destekli olarak yanıtlamasına yardımcı olan
            bir müşteri iletişim platformudur.
          </p>
        </div>

        <div>
          <h2 className="font-semibold">2. Hangi verileri işliyoruz?</h2>
          <p className="mt-1.5 text-muted-foreground">
            Bağlı kanallar (web sohbeti, WhatsApp, Instagram, Messenger)
            üzerinden gönderdiğiniz mesajlar, gönderen tanımlayıcısı ve adınız;
            sipariş durumu sorgularında paylaştığınız sipariş numarası,
            e-posta veya telefon bilgisi. Bu veriler yalnızca sorunuzu
            yanıtlamak ve destek geçmişini tutmak için işlenir.
          </p>
        </div>

        <div>
          <h2 className="font-semibold">3. Verileri nasıl saklıyoruz?</h2>
          <p className="mt-1.5 text-muted-foreground">
            Veriler Avrupa Birliği bölgesinde barındırılan güvenli
            veritabanlarında saklanır. Erişim anahtarları ve kimlik bilgileri
            şifrelenerek tutulur. Verileriniz üçüncü taraflara satılmaz veya
            pazarlama amacıyla paylaşılmaz.
          </p>
        </div>

        <div>
          <h2 className="font-semibold">4. Üçüncü taraf hizmetler</h2>
          <p className="mt-1.5 text-muted-foreground">
            Mesajların yanıtlanması için yapay zekâ modeli sağlayıcıları,
            mesajlaşma altyapısı için Meta Platforms (WhatsApp, Instagram,
            Messenger) ve e-ticaret verileri için mağazanın bağlı olduğu
            platform (ikas) kullanılır. Her sağlayıcıya yalnızca hizmetin
            gerektirdiği asgari veri iletilir.
          </p>
        </div>

        <div>
          <h2 className="font-semibold">5. Verilerin silinmesi</h2>
          <p className="mt-1.5 text-muted-foreground">
            Konuşma verilerinizin silinmesini istediğinizde aşağıdaki iletişim
            adresine başvurabilirsiniz; talepler 30 gün içinde sonuçlandırılır.
            Meta uygulaması kaldırıldığında ilgili kanal verileri için silme
            talebi otomatik olarak işlenir.
          </p>
        </div>

        <div>
          <h2 className="font-semibold">6. İletişim</h2>
          <p className="mt-1.5 text-muted-foreground">
            Gizlilikle ilgili sorularınız için:{" "}
            <a
              href="mailto:info@paksofts.com"
              className="font-medium text-foreground underline underline-offset-2"
            >
              info@paksofts.com
            </a>
          </p>
        </div>
      </section>

      <p className="mt-10 border-t border-border/60 pt-4 text-xs text-muted-foreground">
        © 2026 {brandConfig.name} · PakSoft tarafından geliştirildi
      </p>
    </main>
  );
}
