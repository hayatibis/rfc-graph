// Words on the page, English and Turkish. The history is a draft for Hayati to reword;
// every quote is verbatim from RFC 1, RFC 3 or RFC 8700 section 3.1 (checked 6 Nov 2026).

export type Lang = 'en' | 'tr';

const RFC = (n: number, label = `RFC ${n}`) => `<a href="?rfc=${n}" data-rfc="${n}">${label}</a>`;

export const HISTORY: Record<Lang, { title: string; body: string[]; sources: string }> = {
  en: {
    title: 'Request for Comments',
    body: [
      `In early 1969 the ARPANET didn't exist yet. BBN was building the packet switches, the IMPs, and the protocols between the computers were left to a handful of graduate students. In Steve Crocker's words, no other “source of authority appear[ed]”, so they kept designing.`,
      `A month after meeting the BBN crew, at a meeting in Utah, they decided to write their discussions down. Crocker, who organised the notes, worried they would look like a claim to authority they didn't have: “Finally, unable to sleep, I wrote a few humble words.” The ground rules were “that anyone could say anything and that nothing was official”, and Bill Duvall suggested the name: Request for Comments.`,
      `${RFC(1)}, “Host Software”, is dated 7 April 1969 and says it plainly: “Very little of what is here is firm and reactions are expected.” ${RFC(3)} set the bar as low as it would go: “Notes are encouraged to be timely rather than polished.” A note could be one sentence long.`,
      `In 1971 Jon Postel took over the care and feeding of the RFCs and kept at it for twenty-seven years. The humble notes became the way the Internet writes itself down; IP, TCP, DNS, HTTP and TLS all live in them.`,
      `Every RFC points at others. Start here and follow the lines: each star is an RFC, its colour is the year it came out, and the light runs from an RFC to the ones that build on it.`,
    ],
    sources: `Sources: ${RFC(1)}, ${RFC(3)}, ${RFC(8700, 'RFC 8700 §3.1')} (Crocker, “The Origins of RFCs”).`,
  },
  tr: {
    title: 'Request for Comments',
    body: [
      `1969'un başında ARPANET henüz yoktu. BBN paket anahtarlarını, yani IMP'leri yapıyordu; bilgisayarların birbiriyle nasıl konuşacağı ise bir avuç lisansüstü öğrenciye kalmıştı. Steve Crocker'ın anlattığına göre ortada başka bir otorite de çıkmadı, onlar da tasarlamaya devam etti.`,
      `BBN ekibiyle tanışmalarından bir ay sonra, Utah'taki bir toplantıda tartışmalarını yazıya dökmeye karar verdiler. Notları toparlayan Crocker, sahip olmadıkları bir yetkiyi iddia ediyormuş gibi görünmekten çekiniyordu. Uykusu kaçtığı bir gece birkaç alçakgönüllü cümle yazdı. Kural basitti: herkes her şeyi söyleyebilirdi ve hiçbir şey resmî değildi. Adını da Bill Duvall önerdi: Request for Comments.`,
      `${RFC(1)}, “Host Software”, 7 Nisan 1969 tarihli ve kendini açıkça söylüyor: buradakilerin çok azı kesin, tepki bekleniyor. ${RFC(3)} çıtayı olabildiğince alçak tuttu: notların cilalı olmasındansa zamanında olması tercih edilir. Bir not tek cümle bile olabilirdi.`,
      `1971'de RFC'lerin bakımını Jon Postel devraldı ve yirmi yedi yıl sürdürdü. O alçakgönüllü notlar internetin kendini yazıya döktüğü yer oldu; IP, TCP, DNS, HTTP ve TLS hep onların içinde.`,
      `Her RFC başka RFC'leri gösteriyor. Buradan başla ve çizgileri takip et: her yıldız bir RFC, rengi yayımlandığı yıl, ışık da bir RFC'den onun üstüne kurulanlara doğru akıyor.`,
    ],
    sources: `Kaynaklar: ${RFC(1)}, ${RFC(3)}, ${RFC(8700, 'RFC 8700 §3.1')} (Crocker, “The Origins of RFCs”).`,
  },
};

export const UI: Record<Lang, Record<string, string>> = {
  en: {
    tagline: 'Read an RFC with its whole graph in view.',
    go: 'Open',
    placeholder: 'RFC number',
    story: 'Story',
    read: 'Reader',
    citedBy: 'Who cites it',
    citedByShown: '{shown} RFCs of {total} documents that cite it',
    refs: '{n} RFCs it refers to',
    noRefs: 'No recorded references; the lines come from the text.',
    obsoletes: 'Obsoletes',
    obsoletedBy: 'Obsoleted by',
    updates: 'Updates',
    updatedBy: 'Updated by',
    loading: 'Fetching…',
    failed: 'Could not fetch RFC {n}.',
    legendYears: 'year',
    norm: 'normative',
    info: 'informative',
    obs: 'obsoletes',
    upd: 'updates',
    mention: 'named in the text',
    fit: 'Fit',
    reset: 'Reset',
    resetHint: 'Clear the graph and start again from this RFC',
    theme: 'Theme',
    pages: '{n} pages',
    made: 'A toy by Hayati, made for fun. Data: RFC Editor and IETF Datatracker.',
  },
  tr: {
    tagline: 'Bir RFC\'yi bütün graph\'ıyla birlikte oku.',
    go: 'Aç',
    placeholder: 'RFC numarası',
    story: 'Hikâye',
    read: 'Okuyucu',
    citedBy: 'Kim referans veriyor',
    citedByShown: 'Referans veren {total} belgenin {shown} tanesi RFC',
    refs: 'Referans verdiği {n} RFC',
    noRefs: 'Kayıtlı referans yok; çizgiler metinden geliyor.',
    obsoletes: 'Geçersiz kıldığı',
    obsoletedBy: 'Geçersiz kılan',
    updates: 'Güncellediği',
    updatedBy: 'Güncelleyen',
    loading: 'Getiriliyor…',
    failed: 'RFC {n} getirilemedi.',
    legendYears: 'yıl',
    norm: 'normatif',
    info: 'bilgilendirici',
    obs: 'geçersiz kılar',
    upd: 'günceller',
    mention: 'metinde geçiyor',
    fit: 'Sığdır',
    reset: 'Sıfırla',
    resetHint: 'Graph’ı temizle, bu RFC’den yeniden başla',
    theme: 'Tema',
    pages: '{n} sayfa',
    made: 'Hayati\'nin eğlenmek için yaptığı bir oyuncak. Veri: RFC Editor ve IETF Datatracker.',
  },
};

export const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
