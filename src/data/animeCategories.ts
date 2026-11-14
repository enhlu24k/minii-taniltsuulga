import { Question } from './categories';

export type AnimeCategoryId = 'naruto' | 'onepiece' | 'modern' | 'classics';

export interface AnimeCategory {
  id: AnimeCategoryId;
  name: string;
  short: string;
  icon: string;
  questions: Question[];
}

export const ANIME_CATEGORIES: Record<AnimeCategoryId, AnimeCategory> = {
  naruto: {
    id: 'naruto',
    name: 'Наруто & Нинжа',
    short: 'Наруто',
    icon: '🍥',
    questions: [
      { emoji: '🦊🍜🌀', answer: 'Naruto Uzumaki', options: ['Naruto Uzumaki', 'Sasuke Uchiha', 'Minato Namikaze', 'Boruto Uzumaki'] },
      { emoji: '👁️⚡🐍', answer: 'Sasuke Uchiha', options: ['Itachi Uchiha', 'Sasuke Uchiha', 'Kakashi Hatake', 'Madara Uchiha'] },
      { emoji: '😷📖⚡', answer: 'Kakashi Hatake', options: ['Obito Uchiha', 'Kakashi Hatake', 'Might Guy', 'Asuma Sarutobi'] },
      { emoji: '🦅🔥👁️', answer: 'Itachi Uchiha', options: ['Shisui Uchiha', 'Itachi Uchiha', 'Madara Uchiha', 'Sasuke Uchiha'] },
      { emoji: '🌸👊💚', answer: 'Sakura Haruno', options: ['Hinata Hyuga', 'Ino Yamanaka', 'Sakura Haruno', 'Tsunade'] },
      { emoji: '🏜️⏳🦝', answer: 'Gaara', options: ['Kankuro', 'Gaara', 'Sasori', 'Deidara'] },
      { emoji: '🐸✍️🔥', answer: 'Jiraiya', options: ['Orochimaru', 'Jiraiya', 'Hiruzen Sarutobi', 'Kabuto Yakushi'] },
      { emoji: '⚡💛🌀', answer: 'Minato Namikaze', options: ['Minato Namikaze', 'Naruto Uzumaki', 'Tobirama Senju', 'Killer Bee'] },
      { emoji: '🌑☄️👁️', answer: 'Madara Uchiha', options: ['Obito Uchiha', 'Nagato', 'Madara Uchiha', 'Hashirama Senju'] },
      { emoji: '🥋🔥💪', answer: 'Rock Lee', options: ['Neji Hyuga', 'Rock Lee', 'Choji Akimichi', 'Kiba Inuzuka'] },
      { emoji: '👀💜🍥', answer: 'Hinata Hyuga', options: ['Temari', 'Hinata Hyuga', 'Sakura Haruno', 'Tenten'] },
      { emoji: '🌧️🟣👑', answer: 'Pain (Nagato)', options: ['Pain (Nagato)', 'Konan', 'Deidara', 'Kisame Hoshigaki'] },
      { emoji: '🐌🎰💊', answer: 'Tsunade', options: ['Mei Terumi', 'Tsunade', 'Shizune', 'Kushina Uzumaki'] },
      { emoji: '🎭🌀👁️', answer: 'Obito Uchiha', options: ['Zetsu', 'Obito Uchiha', 'Itachi Uchiha', 'Kakuzu'] },
      { emoji: '🐍🧪👅', answer: 'Orochimaru', options: ['Kabuto Yakushi', 'Orochimaru', 'Sasori', 'Hidan'] },
    ],
  },
  onepiece: {
    id: 'onepiece',
    name: 'One Piece & Далайн дээрэмчин',
    short: 'One Piece',
    icon: '🏴‍☠️',
    questions: [
      { emoji: '👒🍖🏴‍☠️', answer: 'Monkey D. Luffy', options: ['Monkey D. Luffy', 'Portgas D. Ace', 'Shanks', 'Gol D. Roger'] },
      { emoji: '⚔️💚🧭', answer: 'Roronoa Zoro', options: ['Mihawk', 'Roronoa Zoro', 'Sanji', 'Trafalgar Law'] },
      { emoji: '🍊⚡💰', answer: 'Nami', options: ['Nico Robin', 'Nami', 'Vivi', 'Boa Hancock'] },
      { emoji: '🚬🦵👨‍🍳', answer: 'Sanji', options: ['Sanji', 'Zoro', 'Usopp', 'Franky'] },
      { emoji: '🦌🩺🍭', answer: 'Tony Tony Chopper', options: ['Bepo', 'Tony Tony Chopper', 'Brook', 'Carrot'] },
      { emoji: '📚🌸✋', answer: 'Nico Robin', options: ['Nami', 'Nico Robin', 'Perona', 'Yamato'] },
      { emoji: '🔥👒👊', answer: 'Portgas D. Ace', options: ['Sabo', 'Portgas D. Ace', 'Marco', 'Akainu'] },
      { emoji: '🍷⚔️🔴', answer: 'Shanks', options: ['Buggy', 'Shanks', 'Rayleigh', 'Mihawk'] },
      { emoji: '🏥⚔️💛', answer: 'Trafalgar Law', options: ['Eustass Kid', 'Trafalgar Law', 'Doflamingo', 'Crocodile'] },
      { emoji: '💀🎻🎩', answer: 'Brook', options: ['Brook', 'Franky', 'Moria', 'Jinbe'] },
      { emoji: '🤖🕶️🥤', answer: 'Franky', options: ['Bartholomew Kuma', 'Franky', 'Vegapunk', 'Jinbe'] },
      { emoji: '🤥🎯🌿', answer: 'Usopp', options: ['Buggy', 'Usopp', 'Yasopp', 'Van Augur'] },
      { emoji: '🦈🥋🌊', answer: 'Jinbe', options: ['Arlong', 'Jinbe', 'Fisher Tiger', 'Hody Jones'] },
      { emoji: '🐍💘👑', answer: 'Boa Hancock', options: ['Big Mom', 'Boa Hancock', 'Nico Robin', 'Shirahoshi'] },
      { emoji: '🌊💥🧔', answer: 'Whitebeard', options: ['Blackbeard', 'Kaido', 'Whitebeard', 'Garp'] },
    ],
  },
  modern: {
    id: 'modern',
    name: 'Demon Slayer & Jujutsu',
    short: 'Шинэ үеийн хит',
    icon: '⚔️',
    questions: [
      { emoji: '🌊🔥🎋', answer: 'Tanjiro Kamado', options: ['Tanjiro Kamado', 'Giyu Tomioka', 'Kyojuro Rengoku', 'Muichiro Tokito'] },
      { emoji: '🎋🎀😈', answer: 'Nezuko Kamado', options: ['Shinobu Kocho', 'Nezuko Kamado', 'Mitsuri Kanroji', 'Kanao Tsuyuri'] },
      { emoji: '⚡😭💛', answer: 'Zenitsu Agatsuma', options: ['Inosuke Hashibira', 'Zenitsu Agatsuma', 'Genya Shinazugawa', 'Tengen Uzui'] },
      { emoji: '🐗⚔️😤', answer: 'Inosuke Hashibira', options: ['Inosuke Hashibira', 'Sanemi Shinazugawa', 'Gyomei Himejima', 'Tanjiro Kamado'] },
      { emoji: '🔥🍱🦁', answer: 'Kyojuro Rengoku', options: ['Tengen Uzui', 'Kyojuro Rengoku', 'Mitsuri Kanroji', 'Obanai Iguro'] },
      { emoji: '😎🤞🔵', answer: 'Gojo Satoru', options: ['Suguru Geto', 'Gojo Satoru', 'Megumi Fushiguro', 'Nanami Kento'] },
      { emoji: '👊🩷👹', answer: 'Yuji Itadori', options: ['Yuji Itadori', 'Yuta Okkotsu', 'Aoi Todo', 'Toge Inumaki'] },
      { emoji: '🐺🌑✋', answer: 'Megumi Fushiguro', options: ['Toji Fushiguro', 'Megumi Fushiguro', 'Yuta Okkotsu', 'Choso'] },
      { emoji: '🔨🌹🧡', answer: 'Nobara Kugisaki', options: ['Maki Zenin', 'Nobara Kugisaki', 'Mei Mei', 'Miwa Kasumi'] },
      { emoji: '👹🔥👑', answer: 'Ryomen Sukuna', options: ['Mahito', 'Ryomen Sukuna', 'Jogo', 'Kenjaku'] },
      { emoji: '🧹⚔️😤', answer: 'Levi Ackerman', options: ['Eren Yeager', 'Levi Ackerman', 'Erwin Smith', 'Jean Kirstein'] },
      { emoji: '🗝️🧱⚡', answer: 'Eren Yeager', options: ['Armin Arlert', 'Eren Yeager', 'Reiner Braun', 'Zeke Yeager'] },
      { emoji: '🧣⚔️🖤', answer: 'Mikasa Ackerman', options: ['Annie Leonhart', 'Historia Reiss', 'Mikasa Ackerman', 'Sasha Braus'] },
      { emoji: '🪚😈🐶', answer: 'Denji (Chainsaw Man)', options: ['Aki Hayakawa', 'Denji (Chainsaw Man)', 'Power', 'Makima'] },
      { emoji: '🥜🕵️‍♀️✨', answer: 'Anya Forger', options: ['Yor Forger', 'Anya Forger', 'Becky Blackbell', 'Loid Forger'] },
    ],
  },
  classics: {
    id: 'classics',
    name: 'Сонгодог & Домогт',
    short: 'Сонгодог',
    icon: '🐉',
    questions: [
      { emoji: '🐉🧡☁️', answer: 'Son Goku', options: ['Son Goku', 'Vegeta', 'Gohan', 'Trunks'] },
      { emoji: '👑🔵💥', answer: 'Vegeta', options: ['Piccolo', 'Vegeta', 'Broly', 'Goku'] },
      { emoji: '📓🍎✍️', answer: 'Light Yagami', options: ['L Lawliet', 'Light Yagami', 'Ryuk', 'Near'] },
      { emoji: '🍰🪑🔍', answer: 'L Lawliet', options: ['Light Yagami', 'L Lawliet', 'Mello', 'Conan Edogawa'] },
      { emoji: '🦾🔴⚗️', answer: 'Edward Elric', options: ['Alphonse Elric', 'Edward Elric', 'Roy Mustang', 'Scar'] },
      { emoji: '🥚👊💛', answer: 'Saitama', options: ['Genos', 'Saitama', 'King', 'Garou'] },
      { emoji: '🍓⚔️🖤', answer: 'Ichigo Kurosaki', options: ['Byakuya Kuchiki', 'Ichigo Kurosaki', 'Renji Abarai', 'Sosuke Aizen'] },
      { emoji: '⚡🐭🧢', answer: 'Ash Ketchum', options: ['Gary Oak', 'Ash Ketchum', 'Brock', 'Goh'] },
      { emoji: '☂️🌲🚌', answer: 'Totoro', options: ['No-Face', 'Totoro', 'Ponyo', 'Howl'] },
      { emoji: '🚀🚬🔫', answer: 'Spike Spiegel', options: ['Jet Black', 'Spike Spiegel', 'Vash the Stampede', 'Alucard'] },
      { emoji: '🌙🎀✨', answer: 'Sailor Moon', options: ['Cardcaptor Sakura', 'Sailor Moon', 'Madoka Kaname', 'Miku'] },
      { emoji: '👦👓⚽', answer: 'Conan Edogawa', options: ['Shinichi Kudo', 'Conan Edogawa', 'Kaito Kid', 'Lupin III'] },
      { emoji: '🤖💙😺', answer: 'Doraemon', options: ['Astro Boy', 'Doraemon', 'Pikachu', 'Keroro'] },
      { emoji: '🃏🎩🕊️', answer: 'Hisoka Morow', options: ['Chrollo Lucilfer', 'Hisoka Morow', 'Killua Zoldyck', 'Gon Freecss'] },
      { emoji: '⚡🛹🤍', answer: 'Killua Zoldyck', options: ['Gon Freecss', 'Kurapika', 'Killua Zoldyck', 'Leorio'] },
    ],
  },
};
