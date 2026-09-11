export type Locale = "zh" | "en";
export type Theme = "light" | "dark";
export type Service = "rides" | "drive" | "market" | "sublet";
export const COPY = {
  zh: {
    skip: "跳到主要内容",
    home: "LinkX 极链行首页",
    navigation: "主导航",
    rides: "拼车",
    life: "生活服务",
    how: "如何使用",
    switchLocale: "Switch to English",
    dark: "切换深色模式",
    light: "切换浅色模式",
    openMenu: "打开导航",
    closeMenu: "关闭导航",
    openMini: "前往小程序",
    heroOne: "一路同向，",
    heroTwo: "一起出发。",
    description:
      "连接纽约与新泽西的同路人。\n从日常通勤到周末出行，让下一程有人同行。",
    findRide: "寻找拼车",
    offerRide: "我有空座",
    miniNote: "在微信小程序中查看、发布和加入路线",
    bridgeAlt: "从新泽西一侧望向乔治·华盛顿大桥，蓝天下的桥梁跨越哈德逊河",
    ridesLabel: "RIDE TOGETHER",
    rideTitle: "同路，刚好一起。",
    rideIntro: "从找车到出发，留下真正需要的信息。",
    rideBenefits: [
      {
        title: "找到合适的一程",
        body: "按出发地、目的地和时间查看路线，找到与你同向的人。",
      },
      {
        title: "把空座分享出去",
        body: "发布你的行程，让同行的人分担路费，也多一份路上的陪伴。",
      },
      {
        title: "出发前，先联系好",
        body: "查看路线详情，确认集合地点、时间与费用，再一起出发。",
      },
    ],
    coverage: "从这里出发",
    viewRides: "查看拼车入口",
    lifeLabel: "LIFE, CONNECTED",
    lifeTitle: "生活里的事，也顺路。",
    lifeIntro: "一个熟悉的社区，不止一次同行。",
    howLabel: "GET STARTED",
    howTitle: "打开微信，\n就能开始。",
    howIntro: "无需另装 App，拼车、二手和转租都在“极链行服务”小程序。",
    steps: [
      { title: "找到极链行服务", body: "在微信中搜索小程序名称，进入首页。" },
      { title: "登录并完善资料", body: "准备好出行所需的联系信息。" },
      { title: "选择你的下一程", body: "查看已有路线，或发布自己的行程。" },
    ],
    faqTitle: "你可能想知道",
    faq: [
      {
        q: "网页上可以直接预订拼车吗？",
        a: "目前查看路线、发布行程和加入拼车都在微信小程序中完成。点击“寻找拼车”，即可查看进入方式。",
      },
      {
        q: "拼车费用和集合地点怎么确认？",
        a: "请先查看路线详情，并在出发前与同行人确认费用、集合地点和时间。",
      },
      {
        q: "在哪里看二手商品和转租信息？",
        a: "进入“极链行服务”小程序，切换底部的“二手”或“转租”页面，就能查看和发布信息。",
      },
    ],
    footer: "让同路的人，更近一点。",
    backTop: "回到顶部",
    photoCredit: "Photo: Acroterion · CC BY-SA 4.0",
    close: "关闭",
    dialogIntro: "在微信小程序中继续。",
    miniNameLabel: "微信小程序名称",
    copy: "复制名称",
    copied: "已复制",
    copyError: "复制未成功，可以长按选中上方名称，手动复制到微信搜索。",
    copySuccess: "名称已复制，打开微信搜索即可。",
    dialogNote: "也可以直接在微信中搜索“极链行服务”。",
    gotIt: "知道了",
  },
  en: {
    skip: "Skip to content",
    home: "LinkX home",
    navigation: "Main navigation",
    rides: "Rides",
    life: "Everyday life",
    how: "How it works",
    switchLocale: "切换为中文",
    dark: "Switch to dark mode",
    light: "Switch to light mode",
    openMenu: "Open navigation",
    closeMenu: "Close navigation",
    openMini: "Open in WeChat",
    heroOne: "Going your way.",
    heroTwo: "Better together.",
    description:
      "Meet people travelling between New York and New Jersey.\nFrom your daily commute to a weekend out, share the ride.",
    findRide: "Find a ride",
    offerRide: "Offer a seat",
    miniNote: "Find, share and join rides in our WeChat mini program",
    bridgeAlt:
      "The George Washington Bridge spans the Hudson River under a blue sky, viewed from New Jersey",
    ridesLabel: "RIDE TOGETHER",
    rideTitle: "Same direction. Good company.",
    rideIntro: "Just the details you need to get moving.",
    rideBenefits: [
      {
        title: "Find your next ride",
        body: "Browse by departure, destination and time to find people going your way.",
      },
      {
        title: "Share your spare seats",
        body: "Post your trip, share the cost and have some company along the way.",
      },
      {
        title: "Connect before you go",
        body: "Check the ride details and agree on your meeting point, time and cost.",
      },
    ],
    coverage: "Connecting our community",
    viewRides: "Find us on WeChat",
    lifeLabel: "LIFE, CONNECTED",
    lifeTitle: "A little more than a ride.",
    lifeIntro: "The same community, for everyday life.",
    howLabel: "GET STARTED",
    howTitle: "Open WeChat.\nYou’re on your way.",
    howIntro:
      "No extra app. Rides, secondhand finds and sublets are all in 极链行服务 on WeChat.",
    steps: [
      {
        title: "Find 极链行服务",
        body: "Search for our mini program in WeChat and open the home page.",
      },
      {
        title: "Sign in and add your details",
        body: "Set up the contact information you need for your trip.",
      },
      {
        title: "Choose your next ride",
        body: "Browse existing rides or share a trip of your own.",
      },
    ],
    faqTitle: "Good to know",
    faq: [
      {
        q: "Can I book a ride on this website?",
        a: "For now, browsing, posting and joining rides happen in our WeChat mini program. Select “Find a ride” to see how to open it.",
      },
      {
        q: "How do I confirm the cost and meeting point?",
        a: "Check the ride details and contact your travel companion before departure to agree on the cost, meeting point and time.",
      },
      {
        q: "Where can I find secondhand items and sublets?",
        a: "Open 极链行服务 in WeChat and select the Market (二手) or Sublets (转租) tab to browse or post a listing.",
      },
    ],
    footer: "Bringing people going the same way, closer.",
    backTop: "Back to top",
    photoCredit: "Photo: Acroterion · CC BY-SA 4.0",
    close: "Close",
    dialogIntro: "Continue in our WeChat mini program.",
    miniNameLabel: "WeChat mini program name",
    copy: "Copy name",
    copied: "Copied",
    copyError:
      "Copy wasn’t available. Select the name above and copy it into WeChat search.",
    copySuccess: "Name copied. Open WeChat and paste it into search.",
    dialogNote: "You can also search directly for 极链行服务 in WeChat.",
    gotIt: "Got it",
  },
} as const;
export const SERVICES: Record<
  Service,
  Record<
    Locale,
    {
      label: string;
      title: string;
      body: string;
      cta: string;
      dialogTitle: string;
    }
  >
> = {
  rides: {
    zh: {
      label: "拼车",
      title: "寻找拼车",
      body: "",
      cta: "",
      dialogTitle: "找到你的同路人",
    },
    en: {
      label: "Rides",
      title: "Find a ride",
      body: "",
      cta: "",
      dialogTitle: "Find people going your way",
    },
  },
  drive: {
    zh: {
      label: "发布",
      title: "分享空座",
      body: "",
      cta: "",
      dialogTitle: "把你的空座分享出去",
    },
    en: {
      label: "Offer a ride",
      title: "Share a seat",
      body: "",
      cta: "",
      dialogTitle: "Make room for a little company",
    },
  },
  market: {
    zh: {
      label: "MARKET / 二手",
      title: "好东西，再用一程。",
      body: "家具、电器、日常好物。在附近的社区里，让闲置遇到下一位主人。",
      cta: "逛逛二手",
      dialogTitle: "发现社区里的好物",
    },
    en: {
      label: "MARKET",
      title: "Good things. Another chapter.",
      body: "Furniture, electronics and everyday finds. Give useful things a new home in your community.",
      cta: "Explore the market",
      dialogTitle: "Find your next secondhand favourite",
    },
  },
  sublet: {
    zh: {
      label: "SUBLET / 转租",
      title: "为下一站，找个家。",
      body: "按区域、房型和入住时间查看转租信息，直接联系发布者。",
      cta: "看看转租",
      dialogTitle: "找到下一站的住处",
    },
    en: {
      label: "SUBLETS",
      title: "A place for your next chapter.",
      body: "Browse sublets by area, room type and move-in date. Get in touch with the person listing it.",
      cta: "Explore sublets",
      dialogTitle: "Find a place for your next chapter",
    },
  },
};
export function miniProgramSteps(service: Service, locale: Locale): string[] {
  const dest = {
    rides: [
      "在首页点击“加入路线”，查看可选行程。",
      "Select 加入路线 (Join a ride) on the home page.",
    ],
    drive: [
      "在首页点击“发起路线”，填写并发布行程。",
      "Select 发起路线 (Create a ride) on the home page.",
    ],
    market: [
      "进入底部“二手”页面，查看或发布商品。",
      "Open the 二手 (Market) tab to browse or post items.",
    ],
    sublet: [
      "进入底部“转租”页面，查看或发布房源。",
      "Open the 转租 (Sublets) tab to browse or post listings.",
    ],
  }[service];
  return locale === "zh"
    ? [
        "打开微信，搜索“极链行服务”。",
        "选择“小程序”，进入极链行服务。",
        dest[0],
      ]
    : [
        "Open WeChat and search for 极链行服务.",
        "Select Mini Programs, then open 极链行服务.",
        dest[1],
      ];
}
