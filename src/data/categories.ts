export type CategoryId = 'football' | 'basketball' | 'f1' | 'motogp';

export interface Question {
  emoji: string;
  answer: string;
  options: string[];
}

export interface Category {
  id: CategoryId;
  name: string;
  short: string;
  icon: string;
  questions: Question[];
}

export const CATEGORIES: Record<CategoryId, Category> = {
  football: {
    id: 'football',
    name: 'Хөлбөмбөгчид',
    short: 'Хөлбөмбөг',
    icon: '⚽',
    questions: [
      { emoji: '🐐⚽🏆', answer: 'Lionel Messi', options: ['Lionel Messi', 'Neymar Jr', 'Luis Suarez', 'Angel Di Maria'] },
      { emoji: '👑🚀⚽', answer: 'Cristiano Ronaldo', options: ['Kylian Mbappe', 'Cristiano Ronaldo', 'Harry Kane', 'Erling Haaland'] },
      { emoji: '🇧🇷🕺⚽', answer: 'Neymar Jr', options: ['Vinicius Jr', 'Ronaldinho', 'Neymar Jr', 'Raphinha'] },
      { emoji: '🚀⚡🥅', answer: 'Kylian Mbappe', options: ['Kylian Mbappe', 'Antoine Griezmann', 'Ousmane Dembele', 'Karim Benzema'] },
      { emoji: '🤖⚽🔥', answer: 'Erling Haaland', options: ['Harry Kane', 'Erling Haaland', 'Robert Lewandowski', 'Mohamed Salah'] },
      { emoji: '👑🎯⚡', answer: 'Mohamed Salah', options: ['Sadio Mane', 'Riyad Mahrez', 'Mohamed Salah', 'Son Heung-min'] },
      { emoji: '🪄🎩⚽', answer: 'Ronaldinho', options: ['Kaka', 'Ronaldinho', 'Ronaldo Nazario', 'Pele'] },
      { emoji: '🏆🧠⚽', answer: 'Zinedine Zidane', options: ['David Beckham', 'Zinedine Zidane', 'Thierry Henry', 'Andrea Pirlo'] },
      { emoji: '🦁💪⚽', answer: 'Zlatan Ibrahimovic', options: ['Zlatan Ibrahimovic', 'Didier Drogba', "Samuel Eto'o", 'Wayne Rooney'] },
      { emoji: '🎯⚽🔥', answer: 'Harry Kane', options: ['Erling Haaland', 'Karim Benzema', 'Harry Kane', 'Robert Lewandowski'] },
      { emoji: '🧤🧱🏆', answer: 'Thibaut Courtois', options: ['Alisson Becker', 'Ederson', 'Thibaut Courtois', 'Manuel Neuer'] },
      { emoji: '⚡🎮⭐', answer: 'Vinicius Junior', options: ['Rodrygo', 'Vinicius Junior', 'Neymar Jr', 'Jude Bellingham'] },
      { emoji: '🎩⚽🧠', answer: 'Kevin De Bruyne', options: ['Bruno Fernandes', 'Luka Modric', 'Kevin De Bruyne', 'Toni Kroos'] },
      { emoji: '🏴⚽🔥', answer: 'David Beckham', options: ['David Beckham', 'Wayne Rooney', 'Steven Gerrard', 'Frank Lampard'] },
      { emoji: '🇧🇷🐐🏆', answer: 'Pele', options: ['Pele', 'Rivaldo', 'Kaka', 'Romario'] },
    ],
  },
  basketball: {
    id: 'basketball',
    name: 'Сагсан бөмбөгчид',
    short: 'Сагсан бөмбөг',
    icon: '🏀',
    questions: [
      { emoji: '🐐✈️🏀', answer: 'Michael Jordan', options: ['Michael Jordan', 'Kobe Bryant', 'LeBron James', 'Magic Johnson'] },
      { emoji: '👑🚂🏀', answer: 'LeBron James', options: ['Kevin Durant', 'LeBron James', 'Kawhi Leonard', 'Carmelo Anthony'] },
      { emoji: '🐍💜🏆', answer: 'Kobe Bryant', options: ['Allen Iverson', 'Dwyane Wade', 'Kobe Bryant', 'Tracy McGrady'] },
      { emoji: '👨‍🍳🎯💦', answer: 'Stephen Curry', options: ['Klay Thompson', 'Damian Lillard', 'Stephen Curry', 'Ray Allen'] },
      { emoji: '🏋️‍♂️💥🏀', answer: "Shaquille O'Neal", options: ["Shaquille O'Neal", 'Dwight Howard', 'Yao Ming', 'Tim Duncan'] },
      { emoji: '🃏🐴🧠', answer: 'Nikola Jokic', options: ['Luka Doncic', 'Nikola Jokic', 'Joel Embiid', 'Domantas Sabonis'] },
      { emoji: '🦌💪🏆', answer: 'Giannis Antetokounmpo', options: ['Giannis Antetokounmpo', 'Joel Embiid', 'Pascal Siakam', 'Anthony Davis'] },
      { emoji: '🪄🇸🇮🎯', answer: 'Luka Doncic', options: ['Nikola Jokic', 'Luka Doncic', 'Bogdan Bogdanovic', 'Goran Dragic'] },
      { emoji: '👽🗼🏀', answer: 'Victor Wembanyama', options: ['Rudy Gobert', 'Chet Holmgren', 'Victor Wembanyama', 'Kristaps Porzingis'] },
      { emoji: '🥽🪝🏆', answer: 'Kareem Abdul-Jabbar', options: ['Wilt Chamberlain', 'Bill Russell', 'Kareem Abdul-Jabbar', 'Hakeem Olajuwon'] },
      { emoji: '⌚🎯🔥', answer: 'Damian Lillard', options: ['Kyrie Irving', 'Damian Lillard', 'Trae Young', 'Ja Morant'] },
      { emoji: '🐍⏳🎯', answer: 'Kevin Durant', options: ['Kevin Durant', 'Paul George', 'Jayson Tatum', 'Brandon Ingram'] },
      { emoji: '🎩✨🏀', answer: 'Magic Johnson', options: ['Larry Bird', 'Isiah Thomas', 'Magic Johnson', 'John Stockton'] },
      { emoji: '⚡👟🏀', answer: 'Allen Iverson', options: ['Allen Iverson', 'Steve Nash', 'Chris Paul', 'Derrick Rose'] },
      { emoji: '🦵🎯🏆', answer: 'Dirk Nowitzki', options: ['Pau Gasol', 'Dirk Nowitzki', 'Kevin Garnett', 'Tim Duncan'] },
    ],
  },
  f1: {
    id: 'f1',
    name: 'F1 Нисгэгчид',
    short: 'Formula 1',
    icon: '🏎️',
    questions: [
      { emoji: '🦁⚡🏎️', answer: 'Max Verstappen', options: ['Max Verstappen', 'Sergio Perez', 'Charles Leclerc', 'Lando Norris'] },
      { emoji: '👑🟣7️⃣', answer: 'Lewis Hamilton', options: ['Michael Schumacher', 'Lewis Hamilton', 'George Russell', 'Jenson Button'] },
      { emoji: '🔴7️⃣🏆', answer: 'Michael Schumacher', options: ['Michael Schumacher', 'Sebastian Vettel', 'Nico Rosberg', 'Niki Lauda'] },
      { emoji: '💛💚☔', answer: 'Ayrton Senna', options: ['Alain Prost', 'Nelson Piquet', 'Ayrton Senna', 'Emerson Fittipaldi'] },
      { emoji: '🇲🇨🔴🎹', answer: 'Charles Leclerc', options: ['Carlos Sainz', 'Charles Leclerc', 'Pierre Gasly', 'Esteban Ocon'] },
      { emoji: '🟠🎮🏆', answer: 'Lando Norris', options: ['Oscar Piastri', 'Lando Norris', 'Alex Albon', 'George Russell'] },
      { emoji: '🐂🎯⏳', answer: 'Fernando Alonso', options: ['Carlos Sainz', 'Fernando Alonso', 'Sebastian Vettel', 'Mark Webber'] },
      { emoji: '🧊😎🏎️', answer: 'Kimi Raikkonen', options: ['Mika Hakkinen', 'Valtteri Bottas', 'Kimi Raikkonen', 'Heikki Kovalainen'] },
      { emoji: '☝️🐝🏆', answer: 'Sebastian Vettel', options: ['Sebastian Vettel', 'Nico Rosberg', 'Mark Webber', 'Michael Schumacher'] },
      { emoji: '👶🌟🏎️', answer: 'Kimi Antonelli', options: ['Oliver Bearman', 'Kimi Antonelli', 'Oscar Piastri', 'Liam Lawson'] },
      { emoji: '🦘🧊🟠', answer: 'Oscar Piastri', options: ['Daniel Ricciardo', 'Mark Webber', 'Oscar Piastri', 'Jack Doohan'] },
      { emoji: '🍯🦡👟', answer: 'Daniel Ricciardo', options: ['Daniel Ricciardo', 'Oscar Piastri', 'Valtteri Bottas', 'Kevin Magnussen'] },
      { emoji: '🌶️🎶🏎️', answer: 'Carlos Sainz', options: ['Fernando Alonso', 'Carlos Sainz', 'Charles Leclerc', 'Sergio Perez'] },
      { emoji: '🔴🧢🔥', answer: 'Niki Lauda', options: ['James Hunt', 'Alain Prost', 'Niki Lauda', 'Jackie Stewart'] },
      { emoji: '🎩📊🏎️', answer: 'George Russell', options: ['Lando Norris', 'George Russell', 'Alex Albon', 'Lewis Hamilton'] },
    ],
  },
  motogp: {
    id: 'motogp',
    name: 'MotoGP Нисгэгчид',
    short: 'MotoGP',
    icon: '🏍️',
    questions: [
      { emoji: '👨‍⚕️💛🐢', answer: 'Valentino Rossi', options: ['Valentino Rossi', 'Max Biaggi', 'Loris Capirossi', 'Andrea Dovizioso'] },
      { emoji: '🐜🔴🏆', answer: 'Marc Marquez', options: ['Jorge Lorenzo', 'Marc Marquez', 'Dani Pedrosa', 'Alex Marquez'] },
      { emoji: '🔴🎩🏍️', answer: 'Francesco Bagnaia', options: ['Francesco Bagnaia', 'Enea Bastianini', 'Marco Bezzecchi', 'Franco Morbidelli'] },
      { emoji: '🤖⚡🏍️', answer: 'Jorge Martin', options: ['Jorge Martin', 'Maverick Vinales', 'Aleix Espargaro', 'Alex Rins'] },
      { emoji: '😈💙🏍️', answer: 'Fabio Quartararo', options: ['Johann Zarco', 'Fabio Quartararo', 'Franco Morbidelli', 'Jack Miller'] },
      { emoji: '🦈🚀🏍️', answer: 'Pedro Acosta', options: ['Raul Fernandez', 'Fermin Aldeguer', 'Pedro Acosta', 'Joan Mir'] },
      { emoji: '🦘🔥🏆', answer: 'Casey Stoner', options: ['Jack Miller', 'Casey Stoner', 'Mick Doohan', 'Troy Bayliss'] },
      { emoji: '🥷🪶🏍️', answer: 'Dani Pedrosa', options: ['Dani Pedrosa', 'Jorge Lorenzo', 'Sete Gibernau', 'Alex Criville'] },
      { emoji: '🔨🍭🏍️', answer: 'Jorge Lorenzo', options: ['Marc Marquez', 'Jorge Lorenzo', 'Dani Pedrosa', 'Cal Crutchlow'] },
      { emoji: '🐴🔴🏍️', answer: 'Andrea Dovizioso', options: ['Andrea Iannone', 'Danilo Petrucci', 'Andrea Dovizioso', 'Marco Melandri'] },
      { emoji: '👑🇮🇹🏆', answer: 'Giacomo Agostini', options: ['Giacomo Agostini', 'Valentino Rossi', 'Mike Hailwood', 'Angel Nieto'] },
      { emoji: '🦘5️⃣🏆', answer: 'Mick Doohan', options: ['Wayne Gardner', 'Casey Stoner', 'Mick Doohan', 'Kevin Schwantz'] },
      { emoji: '🇺🇸⭐🏍️', answer: 'Nicky Hayden', options: ['Ben Spies', 'Colin Edwards', 'Nicky Hayden', 'Kenny Roberts Jr'] },
      { emoji: '🦂🖤🏍️', answer: 'Marco Bezzecchi', options: ['Marco Bezzecchi', 'Luca Marini', 'Fabio Di Giannantonio', 'Francesco Bagnaia'] },
      { emoji: '🐺🔥🏍️', answer: 'Enea Bastianini', options: ['Enea Bastianini', 'Danilo Petrucci', 'Lorenzo Savadori', 'Andrea Iannone'] },
    ],
  },
};
