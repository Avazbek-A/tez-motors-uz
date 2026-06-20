import type { JourneyStep, JourneyTrigger } from "./journey";

export type JourneyPresetKey = "new_lead_nurture" | "abandoned_reservation" | "post_delivery" | "browsed_no_inquiry";

export interface JourneyPreset {
  key: JourneyPresetKey;
  name: string;
  trigger: JourneyTrigger;
  steps: JourneyStep[];
}

export const JOURNEY_PRESETS: JourneyPreset[] = [
  {
    key: "new_lead_nurture",
    name: "New lead nurture",
    trigger: "new_lead",
    steps: [
      {
        delayHours: 0,
        channel: "auto",
        body: "Здравствуйте, {name}! Спасибо за интерес к {car}. Можем быстро посчитать итоговую цену и сроки доставки.",
        buttonLabel: "Открыть каталог",
        url: "/ru/catalog",
      },
      {
        delayHours: 24,
        channel: "auto",
        body: "{name}, остались вопросы по {car}? Напишите, подберём комплектацию и покажем ближайшие варианты.",
        ai: true,
        aiPrompt: "warm follow-up to answer objections and invite a reply",
      },
      {
        delayHours: 72,
        channel: "auto",
        body: "Если актуально, можем закрепить за вами вариант и подготовить расчёт под ключ. Ответьте на это сообщение.",
        ai: true,
        aiPrompt: "last gentle nudge before lead goes cold",
      },
    ],
  },
  {
    key: "abandoned_reservation",
    name: "Abandoned reservation",
    trigger: "reservation_abandoned",
    steps: [
      {
        delayHours: 0,
        channel: "auto",
        body: "{name}, бронь по {car} ещё не оплачена. Если нужна помощь с депозитом или расчётом, мы рядом.",
        buttonLabel: "Вернуться к заказу",
        url: "/ru/track",
      },
      {
        delayHours: 24,
        channel: "auto",
        body: "Можем удержать вариант только ограниченное время. Напишите, если хотите продлить бронь или подобрать альтернативу.",
      },
    ],
  },
  {
    key: "post_delivery",
    name: "Post-delivery",
    trigger: "delivered",
    steps: [
      {
        delayHours: 48,
        channel: "auto",
        body: "{name}, поздравляем с получением {car}! Будем рады отзыву о Tez Motors.",
        buttonLabel: "Оставить отзыв",
        url: "/ru/reviews",
      },
      {
        delayHours: 336,
        channel: "auto",
        body: "Если друзьям тоже нужен авто из Китая, отправьте им нашу ссылку. Мы всё сделаем под ключ.",
        buttonLabel: "Открыть каталог",
        url: "/ru/catalog",
      },
    ],
  },
  {
    key: "browsed_no_inquiry",
    name: "Browsed no inquiry",
    trigger: "browsed_no_inquiry",
    steps: [
      {
        delayHours: 2,
        channel: "auto",
        body: "Здравствуйте! Видели, что вы смотрели автомобили в Tez Motors. Хотите, подберём 2–3 варианта под бюджет?",
        ai: true,
        aiPrompt: "helpful message after browsing cars without sending an inquiry",
      },
    ],
  },
];

export function journeyPreset(key: JourneyPresetKey): JourneyPreset | undefined {
  return JOURNEY_PRESETS.find((p) => p.key === key);
}
