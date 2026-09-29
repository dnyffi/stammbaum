-- ===================================================================
-- Stammbaum: Tabelle, Sicherheitsregeln (RLS) und alle 215 Personen
-- Einmal komplett in den Supabase SQL Editor einfuegen und 'Run' klicken.
-- ===================================================================

create table if not exists public.personen (
  id bigint primary key,
  vorname text,
  zweitname text,
  nachname text,
  maedchenname text,
  geschlecht text,
  geburt text,
  jg int,
  geburtsort text,
  heimatort text,
  sterbe text,
  todesjahr int,
  beziehungsstatus text,
  ehepartner_raw text,
  ehepartner_ids int8[],
  vater_id bigint references public.personen(id),
  mutter_id bigint references public.personen(id),
  bem text,
  updated_at timestamptz default now()
);

alter table public.personen enable row level security;

drop policy if exists "public kann lesen" on public.personen;
create policy "public kann lesen" on public.personen
  for select to anon using (true);

drop policy if exists "familie kann mit pin schreiben" on public.personen;
create policy "familie kann mit pin schreiben" on public.personen
  for insert to anon with check (
    current_setting('request.headers', true)::json ->> 'x-family-pin' = 'stammbaum2026'
  );

drop policy if exists "familie kann mit pin aendern" on public.personen;
create policy "familie kann mit pin aendern" on public.personen
  for update to anon using (true) with check (
    current_setting('request.headers', true)::json ->> 'x-family-pin' = 'stammbaum2026'
  );

grant select, insert, update on public.personen to anon;

-- Falls du diesen Block ein zweites Mal laufen laesst (z.B. neu starten):
truncate table public.personen restart identity cascade;

-- Personen zuerst ohne Vater/Mutter-Verweise einfuegen, danach die Verweise setzen,
-- damit die Reihenfolge der 215 Zeilen keine Rolle spielt (foreign keys).
insert into public.personen
  (id, vorname, zweitname, nachname, maedchenname, geschlecht, geburt, jg, geburtsort, heimatort, sterbe, todesjahr, beziehungsstatus, ehepartner_raw, ehepartner_ids, bem)
values
  (0, 'Albert', NULL, 'Meier', NULL, 'm', '01.04.1900', 1900, NULL, NULL, '1974', 1974, 'Verheiratet', 'Emma Wydler', {1}, NULL),
  (1, 'Emma', NULL, 'Wydler', NULL, 'w', '12.12.1903', 1903, NULL, NULL, '1995', 1995, 'Verheiratet', 'Albert Meier (1900)', {0}, NULL),
  (2, 'Heinrich', NULL, 'Wydler', NULL, 'm', '1874', 1874, NULL, NULL, '1937', 1937, 'Verheiratet', 'Pauline Schoch', {5}, NULL),
  (3, 'Albert', NULL, 'Meier', NULL, 'm', '1875', 1875, NULL, NULL, '1965', 1965, 'Verheiratet', 'Louise Schwarz', {4}, NULL),
  (4, 'Louise', NULL, 'Schwarz', NULL, 'w', '1877', 1877, NULL, NULL, '1960', 1960, 'Verheiratet', 'Albert Meier', {0}, NULL),
  (5, 'Pauline', NULL, 'Schoch', NULL, 'w', '1879', 1879, NULL, NULL, '1959', 1959, 'Verheiratet', 'Heinrich Wydler', {2}, NULL),
  (6, 'Alfred', NULL, 'Künzi', NULL, 'm', '19.09.1890', 1890, 'Madretsch', 'Trub', '11.02.1969', 1969, 'Verheiratet', 'Marie Kaufmann', {7}, 'Landarbeiter; wuchs bei den Grosseltern auf'),
  (7, 'Marie', NULL, 'Kaufmann', NULL, 'w', '23.07.1902', 1902, NULL, NULL, '14.04.1988', 1988, 'Verheiratet', 'Alfred Künzi', {109}, 'Heirat mit Alfred Künzi: 27.10.1923'),
  (8, 'Heini', NULL, 'Trachsler', NULL, 'm', '1931', 1931, NULL, NULL, '2009', 2009, 'Verheiratet', NULL, NULL, NULL),
  (9, 'Erich', NULL, 'Meier', NULL, 'm', '1958', 1958, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (10, 'Urs', NULL, 'Meier', NULL, 'm', '1961', 1961, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (11, 'Helena', NULL, 'Nyffenegger', NULL, 'w', '22.10.1906', 1906, NULL, 'Huttwil BE', '19.11.1949', 1949, NULL, NULL, NULL, NULL),
  (12, 'Albert', NULL, 'Nyffenegger', NULL, 'm', '12.03.1907', 1907, NULL, 'Huttwil BE', '06.01.1974', 1974, NULL, NULL, NULL, NULL),
  (13, 'Walter', NULL, 'Nyffenegger', NULL, 'm', '13.03.1909', 1909, NULL, 'Huttwil BE', '?', NULL, NULL, NULL, NULL, NULL),
  (14, 'Frieda', NULL, 'Nyffenegger', NULL, 'w', '06.03.1911', 1911, NULL, 'Huttwil BE', '21.02.1986', 1986, NULL, NULL, NULL, NULL),
  (15, 'Rudolf', NULL, 'Nyffenegger', NULL, 'm', '14.09.1913', 1913, NULL, 'Huttwil BE', '21.09.1913', 1913, NULL, NULL, NULL, NULL),
  (16, 'Hans', NULL, 'Nyffenegger', NULL, 'm', '24.05.1914', 1914, NULL, 'Huttwil BE', NULL, 1969, 'Verheiratet', 'Eleonora Anna Bürgisser', {55}, NULL),
  (17, 'Anna', NULL, 'Künzi', NULL, 'w', '26.09.1925', 1925, NULL, NULL, '10.12.2019', 2019, 'Verheiratet', 'Ernst Meier', {24}, NULL),
  (18, 'Ernst', NULL, 'Meier', NULL, 'm', '10.03.1928', 1928, NULL, NULL, '24.02.2002', 2002, 'Verheiratet', 'Anna Küenzi', {17}, NULL),
  (19, 'Hugo', NULL, 'Meier', NULL, 'm', '01.04.1930', 1930, NULL, NULL, '2012', 2012, NULL, NULL, NULL, NULL),
  (20, 'Rudolf', 'Gottfried', 'Nyffenegger', NULL, 'm', '06.03.1947', 1947, NULL, 'Huttwil BE', NULL, NULL, NULL, NULL, NULL, NULL),
  (21, 'Anton', 'Albert', 'Nyffenegger', NULL, 'm', '18.12.1952', 1952, NULL, 'Huttwil BE', NULL, NULL, NULL, NULL, NULL, NULL),
  (22, 'Regula', NULL, 'Nyffenegger', 'Meier', 'w', '11.09.1954', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (23, 'Beat', NULL, 'Nyffenegger', NULL, 'm', '27.10.1954', 1954, NULL, 'Huttwil BE', '2010', 2010, NULL, NULL, NULL, NULL),
  (24, 'Ernst', NULL, 'Meier', NULL, 'm', '16.11.1955', 1955, NULL, NULL, NULL, NULL, 'Verheiratet', 'Mirjam Hotz', NULL, 'Ehepartner Mirjam Hotz (*1965) laut Stammbaum-Notiz; Mutter der Kinder Miriam/Rebekka/Joshua ist in dieser Tabelle als Florance Hagmann erfasst - bitte gegenprüfen'),
  (25, 'Ernst', 'Ulrich', 'Nyffenegger', NULL, 'm', '01.08.1957', 1957, NULL, 'Huttwil BE', NULL, NULL, 'Verheiratet', 'Regula Meier', {66}, NULL),
  (26, 'Anna', 'Monika', 'Trachsler', 'Meier', 'w', '08.01.1959', 1959, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (27, 'Urs', NULL, 'Trachsler', NULL, 'm', '29.02.1960', 1960, NULL, NULL, NULL, NULL, 'Verheiratet', 'Monika Meier', {26}, NULL),
  (28, 'Sasha', NULL, 'Sapora', NULL, NULL, '11.02.1976', 1976, NULL, 'Olten', NULL, NULL, 'Verheiratet', 'Tanja Nyffenegger', NULL, NULL),
  (29, 'Tanja', NULL, 'Tschäppeler', NULL, 'w', '08.03.1978', 1978, NULL, NULL, NULL, NULL, 'Verheiratet', 'Sasha Sapora', {28}, NULL),
  (30, 'Chantal', NULL, 'Meier', NULL, 'w', '03.05.1980', 1980, NULL, NULL, NULL, NULL, 'Verheiratet', 'Adi Steiner', {72}, NULL),
  (31, 'Thomas', 'Jürg', 'Nyffenegger', NULL, 'm', '09.09.1983', 1983, NULL, 'Huttwil BE', NULL, NULL, NULL, NULL, NULL, NULL),
  (32, 'David', NULL, 'Nyffenegger', NULL, 'm', '11.10.1984', 1984, NULL, 'Huttwil BE', NULL, NULL, 'Verheiratet', 'Tabea Gerber', {37}, NULL),
  (33, 'Miriam', NULL, 'Ernst', 'Meier', 'w', '21.03.1986', 1986, NULL, NULL, NULL, NULL, 'Verheiratet', 'Frank Ernst', NULL, NULL),
  (34, 'Simon', NULL, 'Nyffenegger', NULL, 'm', '31.03.1986', 1986, NULL, 'Huttwil BE', NULL, NULL, 'Verheiratet', 'Jessica Nyffenegger', {35}, NULL),
  (35, 'Jessica', NULL, 'Nyffenegger', NULL, 'w', '03.03.1987', 1987, NULL, NULL, NULL, NULL, 'Verheiratet', 'Simon Nyffenegger', {34}, NULL),
  (36, 'Daniel', NULL, 'Nyffenegger', NULL, 'm', '09.08.1988', 1988, NULL, 'Huttwil BE', NULL, NULL, 'Verheiratet', 'Marina Khurs', {38}, NULL),
  (37, 'Tabea', NULL, 'Gerber', NULL, 'w', '29.03.1989', 1989, NULL, 'Bülach', NULL, NULL, 'Verheiratet', 'David Nyffenegger', {32}, NULL),
  (38, 'Marina Serg.', NULL, 'Khurs', NULL, 'w', '18.08.1989', 1989, NULL, 'Плещеницы (BY)', NULL, NULL, 'Verheiratet', 'Daniel Nyffenegger', {36}, NULL),
  (39, 'Rebekka', NULL, 'Wölfli', 'Meier', 'w', '25.02.1990', 1990, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (40, 'Cyrille', NULL, 'Trachsler', NULL, 'm', '05.03.1991', 1991, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (41, 'Joshua', NULL, 'Meier', NULL, 'm', '07.12.1992', 1992, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (42, 'Micha', 'Elia', 'Nyffenegger', NULL, 'm', '23.02.2018', 2018, NULL, 'Huttwil BE', NULL, NULL, NULL, NULL, NULL, NULL),
  (43, 'Andri', NULL, 'Nyffenegger', NULL, 'm', '18.08.2018', 2018, NULL, 'Huttwil BE', NULL, NULL, NULL, NULL, NULL, NULL),
  (44, 'Noem', 'Leana', 'Nyffenegger', NULL, 'w', '25.02.2020', 2020, NULL, 'Huttwil BE', NULL, NULL, NULL, NULL, NULL, NULL),
  (45, 'Ursin', NULL, 'Nyffenegger', NULL, 'm', '17.05.2020', 2020, NULL, 'Huttwil BE', NULL, NULL, NULL, NULL, NULL, NULL),
  (46, 'Janik', 'Mattia', 'Nyffenegger', NULL, 'm', '28.11.2021', 2021, NULL, 'Huttwil BE', NULL, NULL, NULL, NULL, NULL, NULL),
  (47, 'Gregor', NULL, 'Nyffenegger', NULL, 'm', '09.01.2022', 2022, NULL, 'Huttwil BE', NULL, NULL, NULL, NULL, NULL, NULL),
  (48, 'Mark', 'Albert', 'Nyffenegger', NULL, 'm', '26.12.2023', 2023, NULL, 'Huttwil BE', NULL, NULL, NULL, NULL, NULL, NULL),
  (49, 'Hugo', NULL, 'Nyffenegger', NULL, 'm', '17.04.2026', 2026, NULL, 'Huttwil BE', NULL, NULL, NULL, NULL, NULL, NULL),
  (50, 'Gustav', NULL, 'Nyffenegger', NULL, 'm', '05.02.1775', 1775, NULL, 'Huttwil BE', NULL, NULL, NULL, NULL, NULL, NULL),
  (51, 'Johannes', NULL, 'Nyffenegger', NULL, 'm', '08.09.1850', 1850, NULL, 'Huttwil BE', '08.10.1934', 1934, 'Verheiratet', 'Anna Christina Staub', {71}, NULL),
  (52, 'Lina', NULL, 'Beer', NULL, 'w', '12.10.1884', 1884, NULL, 'Huttwil BE', '19.11.1949', 1949, 'Verheiratet', 'Albert Nyffenegger', {12}, NULL),
  (53, 'Albert', NULL, 'Nyffenegger', NULL, 'm', '24.10.1881', 1881, NULL, 'Huttwil BE', '09.09.1953', 1953, 'Verheiratet', 'Lina Beer', {52}, NULL),
  (54, 'Johannes', NULL, 'Nyffenegger', NULL, 'm', '25.09.1809', 1809, NULL, 'Huttwil BE', '?', NULL, 'Verheiratet', 'Anna Christina Staub', {71}, NULL),
  (55, 'Eleonora', 'Anna', 'Bürgisser', NULL, 'w', 'ca. 1924', 1924, NULL, NULL, '26.05.1989', 1989, 'Verheiratet', 'Hans Nyffenegger', {16}, NULL),
  (56, 'Anouk', NULL, 'Ernst', NULL, 'w', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (57, 'Celia', NULL, 'Ernst', NULL, 'w', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (58, 'Kayla', NULL, 'Ernst', NULL, 'w', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (59, 'Robin', NULL, 'Ernst', NULL, 'm', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (60, 'Regula', NULL, 'Gut', NULL, 'w', NULL, NULL, NULL, NULL, '?', NULL, 'Verheiratet', 'Johann Meier', {64}, NULL),
  (61, 'Florance', NULL, 'Hagmann', NULL, 'w', NULL, NULL, NULL, NULL, '?', NULL, NULL, NULL, NULL, NULL),
  (62, 'Frieda', NULL, 'Künzi', NULL, 'w', '19.09.1924', 1924, NULL, NULL, '02.03.1999', 1999, NULL, NULL, NULL, 'ledig'),
  (63, 'Edith', NULL, 'Meier', NULL, 'w', '1960', 1960, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (64, 'Johann', NULL, 'Meier', NULL, 'm', NULL, NULL, NULL, NULL, '?', NULL, 'Verheiratet', 'Regula Gut', {60}, NULL),
  (65, 'Jürg', NULL, 'Meier', NULL, 'm', '1963', 1963, NULL, NULL, '?', NULL, 'Verheiratet', 'Siamara Moser', {69}, NULL),
  (66, 'Regula', NULL, 'Meier', NULL, 'w', NULL, NULL, NULL, NULL, '?', NULL, 'Verheiratet', 'Ernst Ulrich Nyffenegger', {25}, NULL),
  (67, 'Tanisha', NULL, 'Meier', NULL, 'w', NULL, NULL, NULL, NULL, '?', NULL, NULL, NULL, NULL, NULL),
  (68, 'Elias', NULL, 'Moser', NULL, 'm', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (69, 'Siamara', NULL, 'Moser', NULL, 'w', '1969', 1969, NULL, 'Domikanische Rep.', NULL, NULL, 'Verheiratet', 'Jürg Meier', {65}, NULL),
  (70, 'Hanspeter', NULL, 'Nyffenegger', NULL, 'm', NULL, NULL, NULL, NULL, '?', NULL, NULL, NULL, NULL, NULL),
  (71, 'Anna', 'Christina', 'Staub', NULL, 'w', NULL, NULL, NULL, NULL, '?', NULL, 'Verheiratet', 'Johannes Nyffenegger (1850)', {51}, NULL),
  (72, 'Adi', NULL, 'Steiner', NULL, 'm', NULL, NULL, NULL, NULL, NULL, NULL, 'Verheiratet', 'Chantal Steiner', {30}, NULL),
  (73, 'Alex', NULL, 'Steiner', NULL, 'm', '2005', 2005, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (74, 'Leo', NULL, 'Steiner', NULL, 'm', '2016', 2016, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (75, 'Remo', NULL, 'Steiner', NULL, 'm', '2007', 2007, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (76, 'Elsi', NULL, 'Strebel', NULL, 'w', NULL, NULL, NULL, NULL, '?', NULL, NULL, NULL, NULL, NULL),
  (77, 'Christine', NULL, 'Tschäppeler', NULL, 'w', NULL, NULL, NULL, NULL, '?', NULL, 'Verheiratet', 'Ernst Ulrich Nyffenegger', {25}, NULL),
  (78, 'Johann', NULL, 'Künzi', NULL, 'm', '13.10.1833', 1833, 'Lützelflüh', 'Lützelflüh/Madretsch', '01.05.1895', 1895, 'Verheiratet', 'Elisabeth Remund', {79}, NULL),
  (79, 'Elisabeth', NULL, 'Remund', NULL, 'w', '31.12.1837', 1837, 'Wohlen BE', 'Wohlen BE', '10.02.1865', 1865, 'Verheiratet', 'Johann Künzi', {78}, NULL),
  (80, 'Gottfried', NULL, 'Künzi', NULL, 'm', '26.02.1864', 1864, 'Gurbrü', 'Gurbrü/Biel', '28.03.1931', 1931, 'Verheiratet', 'Elisabeth Fuhrer', {81}, 'Milchhändler; Heirat 2.11.1886 in Biel'),
  (81, 'Elisabeth', NULL, 'Fuhrer', NULL, 'w', '17.06.1863', 1863, 'Gündlischwand', 'Gündlischwand/Biel', '?', NULL, 'Verheiratet', 'Gottfried Künzi / Henri Millo', {80,84}, 'Kellnerin in Biel; 2. Heirat 7.6.1893 mit Henri Millo in La Turbie F; wanderte 1939 mit den Kindern nach Frankreich aus'),
  (82, 'Jakob', NULL, 'Fuhrer', NULL, 'm', '?', NULL, NULL, 'Gündlischwand', 'nach 1893', NULL, 'Verheiratet', 'Anna Abegglen', {83}, 'Heirat 25.11.1853; total 7 Kinder'),
  (83, 'Anna', NULL, 'Abegglen', NULL, 'w', NULL, NULL, NULL, NULL, 'nach 1900', NULL, 'Verheiratet', 'Jakob Fuhrer', {82}, NULL),
  (84, 'Henri', NULL, 'Millo', NULL, 'm', '27.10.1864', 1864, NULL, NULL, NULL, NULL, 'Verheiratet', 'Elisabeth Fuhrer', {81}, '2. Heirat mit Elisabeth Fuhrer, 7.6.1893 in La Turbie F'),
  (85, 'Anna', 'Elise', 'Künzi', NULL, 'w', '04.11.1887', 1887, 'Biel', 'Biel', '?', NULL, NULL, NULL, NULL, NULL),
  (86, 'Friedrich', 'Julius', 'Künzi', NULL, 'm', '18.02.1889', 1889, 'Biel', 'Biel', '?', NULL, NULL, NULL, NULL, 'Wanderte nach Amerika aus; meldete sich beim Konsulat in Seattle am 2.3.1939'),
  (87, 'Elisabeth', NULL, 'Künzi', NULL, 'w', '04.07.1892', 1892, NULL, NULL, '?', NULL, NULL, NULL, NULL, 'Uneheliche Tochter'),
  (88, 'Friedrich', NULL, 'Kaufmann', NULL, 'm', NULL, NULL, NULL, NULL, NULL, NULL, 'Verheiratet', 'Magdalena Baumann', {89}, NULL),
  (89, 'Magdalena', NULL, 'Baumann', NULL, 'w', NULL, NULL, NULL, NULL, NULL, NULL, 'Verheiratet', 'Friedrich Kaufmann', {88}, NULL),
  (90, 'Arnold', NULL, 'Kaufmann', NULL, 'm', '28.07.1870', 1870, NULL, 'Grindelwald/Maschwanden', '15.10.1945', 1945, 'Verheiratet', 'Maria Gräub', {93}, 'Heizer, Bahnangestellter BOB, Hilfsmaschinist von Grindelwald; Heirat 8.9.1900 in Interlaken'),
  (91, 'Gottlieb', NULL, 'Gräub', NULL, 'm', NULL, NULL, NULL, NULL, NULL, NULL, 'Verheiratet', 'Anna Maria Bracher', {92}, NULL),
  (92, 'Anna', 'Maria', 'Bracher', NULL, 'w', NULL, NULL, NULL, NULL, NULL, NULL, 'Verheiratet', 'Gottlieb Gräub', {91}, NULL),
  (93, 'Maria', NULL, 'Gräub', NULL, 'w', '02.06.1878', 1878, NULL, 'Grindelwald/Maschwanden', '19.09.1950', 1950, 'Verheiratet', 'Arnold Kaufmann', {90}, 'Familie zog ca. 1937 von Gündlischwand nach Maschwanden (Unterdorf, Hausteil Hurni, käuflich erworben); alle Kinder geb. in Gündlischwand'),
  (94, 'Arnold', NULL, 'Kaufmann', NULL, 'm', '26.06.1901', 1901, 'Gündlischwand', 'Toulouse F', '09.11.1964', 1964, 'Geschieden', 'Clémentine Caussiat / Julie Durrouy / Rose Delort', {95,97,98}, 'Mechaniker/Elektriker; 1. Heirat 16.7.1921 Lourdes (geschieden 23.6.1938); 2. Heirat 8.9.1939 Toulouse; 3. Heirat 13.9.1945 Toulouse'),
  (95, 'Clémentine', 'Augustine Rosalie', 'Caussiat', NULL, 'w', '02.04.1899', 1899, NULL, NULL, NULL, NULL, 'Geschieden', 'Arnold Kaufmann (1901)', {94}, '1. Ehefrau von Arnold Kaufmann, geschieden 23.6.1938'),
  (96, 'André', 'Henri Louis', 'Kaufmann', NULL, 'm', '12.05.1926', 1926, 'Lourdes', 'Lourdes', '30.08.1987', 1987, NULL, NULL, NULL, NULL),
  (97, 'Julie', 'Jeanne', 'Durrouy', NULL, 'w', '13.09.1903', 1903, NULL, NULL, '08.10.1942', 1942, 'Verheiratet', 'Arnold Kaufmann (1901)', {94}, '2. Ehefrau von Arnold Kaufmann, keine Kinder'),
  (98, 'Rose', 'Josephine', 'Delort', NULL, 'w', '19.11.1912', 1912, NULL, NULL, '1988', 1988, 'Verheiratet', 'Arnold Kaufmann (1901)', {94}, '3. Ehefrau von Arnold Kaufmann'),
  (99, 'Michelle', 'Françoise Antoinette', 'Kaufmann', NULL, 'w', '01.09.1946', 1946, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (100, 'Monique', NULL, 'Kaufmann', NULL, 'w', NULL, NULL, NULL, 'Dijon', NULL, NULL, 'Verheiratet', 'Patrik Amirault', NULL, 'Behielt Ledigname'),
  (101, 'Charles', 'Hubert', 'Amirault', NULL, 'm', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (102, 'Verena', NULL, 'Künzi', NULL, 'w', '13.06.1927', 1927, NULL, NULL, '11.06.2014', 2014, 'Verheiratet', 'Werner Wetli', {148}, 'Rufname Vreni'),
  (103, 'Alfred', NULL, 'Künzi', NULL, 'm', '04.02.1930', 1930, NULL, NULL, '02.05.2005', 2005, 'Verheiratet', 'Ruth Beutler', {108}, NULL),
  (104, 'Olga', NULL, 'Künzi', NULL, 'w', '23.04.1931', 1931, NULL, NULL, NULL, NULL, 'Verheiratet', 'Ernst Wetli', {208}, NULL),
  (105, 'Martha', NULL, 'Kaufmann', NULL, 'w', '25.12.1903', 1903, 'Gündlischwand', NULL, '08.11.1975', 1975, 'Geschieden', 'Basil Flück', {106}, 'Heirat 10.8.1940 in Lommiswil SO, geschieden; 1 Kind, das früh starb'),
  (106, 'Basil', NULL, 'Flück', NULL, 'm', NULL, NULL, NULL, 'Lommiswil SO', NULL, NULL, 'Verheiratet', 'Martha Kaufmann', {105}, NULL),
  (107, 'Rosalie', NULL, 'Kaufmann', NULL, 'w', '16.07.1912', 1912, 'Gündlischwand', NULL, '20.09.1980', 1980, NULL, NULL, NULL, 'ledig'),
  (108, 'Ruth', NULL, 'Beutler', NULL, 'w', '1931', 1931, NULL, NULL, NULL, NULL, 'Verheiratet', 'Alfred Künzi (1930)', {103}, NULL),
  (109, 'Alfred', NULL, 'Künzi', NULL, 'm', '1956', 1956, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Frühere Ehepartnerin Helena Stadler im Original durchgestrichen'),
  (110, 'Martina', NULL, 'Künzi', NULL, 'w', '1994', 1994, NULL, NULL, NULL, NULL, 'Verheiratet', 'Lukas Emmenegger', NULL, NULL),
  (111, 'Stefan', NULL, 'Künzi', NULL, 'm', '1997', 1997, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (112, 'Katja', NULL, 'Künzi', NULL, 'w', '1999', 1999, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Kinder Micha, Floti (Lesart unsicher)'),
  (113, 'Ruedi', NULL, 'Künzi', NULL, 'm', '1959', 1959, NULL, NULL, NULL, NULL, 'Verheiratet', 'Claudia Schnyder', {114}, NULL),
  (114, 'Claudia', NULL, 'Schnyder', NULL, 'w', '1960', 1960, NULL, NULL, NULL, NULL, 'Verheiratet', 'Ruedi Künzi', {113}, NULL),
  (115, 'Daniel', NULL, 'Künzi', NULL, 'm', '1984', 1984, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Partnerin evtl. Xenia/Yesenia (Lesart unsicher)'),
  (116, 'Lukas', NULL, 'Künzi', NULL, 'm', '1987', 1987, NULL, NULL, NULL, NULL, 'Verheiratet', 'Katja', NULL, 'Kinder Leona (2016), Jana (2018) - Lesart unsicher'),
  (117, 'Hans', NULL, 'Künzi', NULL, 'm', '1960', 1960, NULL, NULL, NULL, NULL, 'Verheiratet', 'Vreni Nef', {118}, NULL),
  (118, 'Vreni', NULL, 'Nef', NULL, 'w', '1961', 1961, NULL, NULL, NULL, NULL, 'Verheiratet', 'Hans Künzi', {117}, NULL),
  (119, 'Thomas', NULL, 'Künzi', NULL, 'm', '1987', 1987, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (120, 'Michael', NULL, 'Künzi', NULL, 'm', '1989', 1989, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (121, 'Matthias', NULL, 'Künzi', NULL, 'm', '1990', 1990, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (122, 'Nadine', NULL, 'Künzi', NULL, 'w', '1987', 1987, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (123, 'Simon', NULL, 'Künzi', NULL, 'm', '1992', 1992, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (124, 'Ueli', NULL, 'Künzi', NULL, 'm', '1964', 1964, NULL, NULL, NULL, NULL, 'Verheiratet', 'Susann Lehmann', {125}, NULL),
  (125, 'Susann', NULL, 'Lehmann', NULL, 'w', NULL, NULL, NULL, NULL, NULL, NULL, 'Verheiratet', 'Ueli Künzi', {124}, NULL),
  (126, 'Miriam', NULL, 'Künzi', NULL, 'w', '1997', 1997, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (127, 'Michèle', NULL, 'Künzi', NULL, 'w', '1999', 1999, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Kind Romeo (2021) - Lesart unsicher'),
  (128, 'Ruth', NULL, 'Künzi', NULL, 'w', '1963', 1963, NULL, NULL, NULL, NULL, 'Verheiratet', 'Hans Emmenegger', {129}, NULL),
  (129, 'Hans', NULL, 'Emmenegger', NULL, 'm', '1962', 1962, NULL, NULL, NULL, NULL, 'Verheiratet', 'Ruth Künzi', {128}, NULL),
  (130, 'Corinne', NULL, 'Emmenegger', NULL, 'w', '1990', 1990, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '+Simon'),
  (131, 'Andrea', NULL, 'Emmenegger', NULL, 'w', '1992', 1992, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (132, 'Tobias', NULL, 'Emmenegger', NULL, 'm', '1999', 1999, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (133, 'Annemarie', NULL, 'Künzi', NULL, 'w', '1964', 1964, NULL, NULL, NULL, NULL, 'Verheiratet', 'Roger Bachmann', {134}, NULL),
  (134, 'Roger', NULL, 'Bachmann', NULL, 'm', '1961', 1961, NULL, NULL, NULL, NULL, 'Verheiratet', 'Annemarie Künzi', {133}, NULL),
  (135, 'Ueli', NULL, 'Bachmann', NULL, 'm', '1991', 1991, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (136, 'Daniela', NULL, 'Bachmann', NULL, 'w', '1992', 1992, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (137, 'Rahel', NULL, 'Bachmann', NULL, 'w', '1994', 1994, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (138, 'Silvia', NULL, 'Bachmann', NULL, 'w', '1995', 1995, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (139, 'Christian', NULL, 'Künzi', NULL, 'm', '1966', 1966, NULL, NULL, NULL, NULL, 'Verheiratet', 'Marianne Jost', {140}, NULL),
  (140, 'Marianne', NULL, 'Jost', NULL, 'w', NULL, NULL, NULL, NULL, NULL, NULL, 'Verheiratet', 'Christian Künzi', {139}, NULL),
  (141, 'Roman', NULL, 'Künzi', NULL, 'm', '2001', 2001, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (142, 'Margrit', NULL, 'Künzi', NULL, 'w', '1969', 1969, NULL, NULL, NULL, NULL, 'Verheiratet', 'Jürg Schärer', {143}, NULL),
  (143, 'Jürg', NULL, 'Schärer', NULL, 'm', NULL, NULL, NULL, NULL, NULL, NULL, 'Verheiratet', 'Margrit Künzi', {142}, NULL),
  (144, 'Benno', NULL, 'Schärer', NULL, 'm', '1994', 1994, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (145, 'Peter', NULL, 'Schärer', NULL, 'm', '1995', 1995, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (146, 'Nicole', NULL, 'Schärer', NULL, 'w', '1998', 1998, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (147, 'Lars', NULL, 'Schärer', NULL, 'm', '2000', 2000, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (148, 'Werner', NULL, 'Wetli', NULL, 'm', '1922', 1922, NULL, NULL, '2001', 2001, 'Verheiratet', 'Verena Künzi', {102}, NULL),
  (149, 'Vreni', NULL, 'Wetli', NULL, 'w', '1949', 1949, NULL, NULL, NULL, NULL, 'Verheiratet', 'Hans Bär', {150}, NULL),
  (150, 'Hans', NULL, 'Bär', NULL, 'm', NULL, NULL, NULL, NULL, NULL, NULL, 'Verheiratet', 'Vreni Wetli', {149}, NULL),
  (151, 'Markus', NULL, 'Bär', NULL, 'm', '1974', 1974, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '+Danielle'),
  (152, 'Roland', NULL, 'Bär', NULL, 'm', '1976', 1976, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (153, 'Werni', NULL, 'Wetli', NULL, 'm', '1951', 1951, NULL, NULL, NULL, NULL, 'Verheiratet', 'Feli Winiger', {154}, NULL),
  (154, 'Feli', NULL, 'Winiger', NULL, 'w', '1946', 1946, NULL, NULL, NULL, NULL, 'Verheiratet', 'Werni Wetli', {153}, NULL),
  (155, 'Claudia', NULL, 'Wetli', NULL, 'w', '1977', 1977, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '+Cyrill'),
  (156, 'Stefan', NULL, 'Wetli', NULL, 'm', '1977', 1977, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (157, 'Annemarie', NULL, 'Wetli', NULL, 'w', '1952', 1952, NULL, NULL, NULL, NULL, 'Verheiratet', 'Poggy Frutiger', {158}, NULL),
  (158, 'Poggy', NULL, 'Frutiger', NULL, 'm', '1947', 1947, NULL, NULL, NULL, NULL, 'Verheiratet', 'Annemarie Wetli', {157}, NULL),
  (159, 'Andreas', NULL, 'Frutiger', NULL, 'm', '1974', 1974, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (160, 'Stefan', NULL, 'Frutiger', NULL, 'm', '1977', 1977, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (161, 'Wädi', NULL, 'Wetli', NULL, 'm', '1953', 1953, NULL, NULL, NULL, NULL, 'Verheiratet', 'Alexa Büeler', {162}, NULL),
  (162, 'Alexa', NULL, 'Büeler', NULL, 'w', '1957', 1957, NULL, NULL, NULL, NULL, 'Verheiratet', 'Wädi Wetli', {161}, NULL),
  (163, 'Bruno', NULL, 'Wetli', NULL, 'm', '1984', 1984, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '+Chantal (Lesart unsicher)'),
  (164, 'Beat', NULL, 'Wetli', NULL, 'm', '1986', 1986, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (165, 'Urban', NULL, 'Wetli', NULL, 'm', '1987', 1987, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (166, 'Martin', NULL, 'Wetli', NULL, 'm', '1989', 1989, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (167, 'Ursi', NULL, 'Wetli', NULL, 'w', '1955', 1955, NULL, NULL, NULL, NULL, 'Verheiratet', 'Ernst Jordi', {168}, NULL),
  (168, 'Ernst', NULL, 'Jordi', NULL, 'm', '1950', 1950, NULL, NULL, NULL, NULL, 'Verheiratet', 'Ursi Wetli', {167}, NULL),
  (169, 'Thomas', NULL, 'Jordi', NULL, 'm', '1975', 1975, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (170, 'Ramona', NULL, 'Jordi', NULL, 'w', '1976', 1976, NULL, NULL, NULL, NULL, 'Verheiratet', 'Lino', NULL, NULL),
  (171, 'Romina', NULL, 'Jordi', NULL, 'w', '1995', 1995, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Enkelin von Ursi Wetli+Ernst Jordi (Lesart unsicher)'),
  (172, 'Rona', NULL, 'Jordi', NULL, 'w', '1996', 1996, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Enkelin von Ursi Wetli+Ernst Jordi (Lesart unsicher)'),
  (173, 'Peter', NULL, 'Wetli', NULL, 'm', '1957', 1957, NULL, NULL, NULL, NULL, 'Verheiratet', 'Silvia Spillmann', {174}, NULL),
  (174, 'Silvia', NULL, 'Spillmann', NULL, 'w', '1956', 1956, NULL, NULL, NULL, NULL, 'Verheiratet', 'Peter Wetli', {173}, NULL),
  (175, 'Brigitte', NULL, 'Wetli', NULL, 'w', '1982', 1982, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (176, 'Daniela', NULL, 'Wetli', NULL, 'w', '1984', 1984, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (177, 'Maja', NULL, 'Wetli', NULL, 'w', '1987', 1987, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (178, 'Paul', NULL, 'Wetli', NULL, 'm', '1958', 1958, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (179, 'Margrit', NULL, 'Wetli', NULL, 'w', '1960', 1960, NULL, NULL, NULL, NULL, 'Verheiratet', 'Herbi Rüttimann', {180}, NULL),
  (180, 'Herbi', NULL, 'Rüttimann', NULL, 'm', '1964', 1964, NULL, NULL, NULL, NULL, 'Verheiratet', 'Margrit Wetli', {179}, NULL),
  (181, 'Peter', NULL, 'Rüttimann', NULL, 'm', '1987', 1987, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '+Corinne'),
  (182, 'Adrian', NULL, 'Rüttimann', NULL, 'm', '1990', 1990, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Partnerin evtl. Regula (Lesart unsicher)'),
  (183, 'Daniel', NULL, 'Rüttimann', NULL, 'm', '1992', 1992, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (184, 'Reto', NULL, 'Rüttimann', NULL, 'm', '1995', 1995, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (185, 'Christine', NULL, 'Wetli', NULL, 'w', '1964', 1964, NULL, NULL, NULL, NULL, 'Verheiratet', 'Markus Rüttimann', {186}, NULL),
  (186, 'Markus', NULL, 'Rüttimann', NULL, 'm', '1961', 1961, NULL, NULL, NULL, NULL, 'Verheiratet', 'Christine Wetli', {185}, NULL),
  (187, 'Nicole', NULL, 'Rüttimann', NULL, 'w', '1984', 1984, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '+Roger'),
  (188, 'Patrick', NULL, 'Rüttimann', NULL, 'm', '1989', 1989, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Jahreszahl im Original unsicher (evtl. 1980)'),
  (189, 'Janine', NULL, 'Rüttimann', NULL, 'w', '1992', 1992, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (190, 'Fredy', NULL, 'Wetli', NULL, 'm', '1965', 1965, NULL, NULL, NULL, NULL, 'Verheiratet', 'Lilli Schneebeli', {191}, NULL),
  (191, 'Lilli', NULL, 'Schneebeli', NULL, 'w', '1969', 1969, NULL, NULL, NULL, NULL, 'Verheiratet', 'Fredy Wetli', {190}, NULL),
  (192, 'Ruth', NULL, 'Wetli', NULL, 'w', '1968', 1968, NULL, NULL, NULL, NULL, 'Verheiratet', 'Stefan Bieri', {193}, NULL),
  (193, 'Stefan', NULL, 'Bieri', NULL, 'm', '1970', 1970, NULL, NULL, NULL, NULL, 'Verheiratet', 'Ruth Wetli', {192}, NULL),
  (194, 'Sina', NULL, 'Bieri', NULL, 'w', '1993', 1993, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '+Simon'),
  (195, 'Laura', NULL, 'Bieri', NULL, 'w', '1999', 1999, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '+Nico'),
  (196, 'Fiona', NULL, 'Bieri', NULL, 'w', '2001', 2001, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (197, 'Helen', NULL, 'Wetli', NULL, 'w', '1972', 1972, NULL, NULL, NULL, NULL, 'Verheiratet', 'Lukas Berger', {198}, NULL),
  (198, 'Lukas', NULL, 'Berger', NULL, 'm', '1971', 1971, NULL, NULL, NULL, NULL, 'Verheiratet', 'Helen Wetli', {197}, NULL),
  (199, 'Sara', NULL, 'Berger', NULL, 'w', '2003', 2003, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (200, 'Nils', NULL, 'Berger', NULL, 'm', '2006', 2006, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (201, 'Ernst', NULL, 'Wetli', NULL, 'm', '1923', 1923, NULL, NULL, NULL, NULL, 'Verheiratet', 'Olga Künzi', {104}, NULL),
  (202, 'Susanna', NULL, 'Wetli', NULL, 'w', '1954', 1954, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (203, 'Kathi', NULL, 'Wetli', NULL, 'w', '1956', 1956, NULL, NULL, NULL, NULL, 'Verheiratet', 'Albert Nussbaumer', {204}, NULL),
  (204, 'Albert', NULL, 'Nussbaumer', NULL, 'm', '1953', 1953, NULL, NULL, NULL, NULL, 'Verheiratet', 'Kathi Wetli', {203}, NULL),
  (205, 'Sandra', NULL, 'Nussbaumer', NULL, 'w', '1984', 1984, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (206, 'Corinne', NULL, 'Nussbaumer', NULL, 'w', '1987', 1987, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (207, 'Felix', NULL, 'Nussbaumer', NULL, 'm', '1990', 1990, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (208, 'Ernst', NULL, 'Wetli', NULL, 'm', '1959', 1959, NULL, NULL, NULL, NULL, 'Verheiratet', 'Beatrix Künzle', {209}, NULL),
  (209, 'Beatrix', NULL, 'Künzle', NULL, 'w', '1960', 1960, NULL, NULL, NULL, NULL, 'Verheiratet', 'Ernst Wetli (1959)', {208}, NULL),
  (210, 'Evi', NULL, 'Wetli', NULL, 'w', '1960', 1960, NULL, NULL, NULL, NULL, 'Verheiratet', 'Markus Frey', {211}, 'Jahreszahlen im Original unsicher (1960/1954)'),
  (211, 'Markus', NULL, 'Frey', NULL, 'm', NULL, NULL, NULL, NULL, NULL, NULL, 'Verheiratet', 'Evi Wetli', {210}, NULL),
  (212, 'Alena', NULL, 'Frey', NULL, 'w', '1986', 1986, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (213, 'Tina', NULL, 'Frey', NULL, 'w', '1987', 1987, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (214, 'Arthur', NULL, 'Frey', NULL, 'm', '1954', 1954, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Zuordnung unklar, evtl. verwandt mit Markus Frey (Lesart unsicher)');

-- Vater/Mutter-Verweise nachtragen
update public.personen set vater_id = 3, mutter_id = 4 where id = 0;
update public.personen set vater_id = 2, mutter_id = 5 where id = 1;
update public.personen set vater_id = 80, mutter_id = 81 where id = 6;
update public.personen set vater_id = 90, mutter_id = 93 where id = 7;
update public.personen set vater_id = 53, mutter_id = 52 where id = 11;
update public.personen set vater_id = 53, mutter_id = 52 where id = 12;
update public.personen set vater_id = 53, mutter_id = 52 where id = 13;
update public.personen set vater_id = 53, mutter_id = 52 where id = 14;
update public.personen set vater_id = 53, mutter_id = 52 where id = 15;
update public.personen set vater_id = 53, mutter_id = 52 where id = 16;
update public.personen set vater_id = 6, mutter_id = 7 where id = 17;
update public.personen set vater_id = 0, mutter_id = 1 where id = 18;
update public.personen set vater_id = 0, mutter_id = 1 where id = 19;
update public.personen set vater_id = 16, mutter_id = 55 where id = 20;
update public.personen set vater_id = 16, mutter_id = 55 where id = 21;
update public.personen set vater_id = 16, mutter_id = 55 where id = 23;
update public.personen set vater_id = 24, mutter_id = 17 where id = 24;
update public.personen set vater_id = 16, mutter_id = 55 where id = 25;
update public.personen set vater_id = 24, mutter_id = 17 where id = 26;
update public.personen set vater_id = 8, mutter_id = NULL where id = 27;
update public.personen set vater_id = 25, mutter_id = 77 where id = 29;
update public.personen set vater_id = NULL, mutter_id = 26 where id = 30;
update public.personen set vater_id = 25, mutter_id = 66 where id = 31;
update public.personen set vater_id = 25, mutter_id = 66 where id = 32;
update public.personen set vater_id = NULL, mutter_id = 61 where id = 33;
update public.personen set vater_id = 25, mutter_id = 66 where id = 34;
update public.personen set vater_id = 25, mutter_id = 66 where id = 36;
update public.personen set vater_id = NULL, mutter_id = 61 where id = 39;
update public.personen set vater_id = 27, mutter_id = 26 where id = 40;
update public.personen set vater_id = NULL, mutter_id = 61 where id = 41;
update public.personen set vater_id = 32, mutter_id = 37 where id = 42;
update public.personen set vater_id = 34, mutter_id = 35 where id = 43;
update public.personen set vater_id = 32, mutter_id = 37 where id = 44;
update public.personen set vater_id = 34, mutter_id = 35 where id = 45;
update public.personen set vater_id = 32, mutter_id = 37 where id = 46;
update public.personen set vater_id = 36, mutter_id = 38 where id = 47;
update public.personen set vater_id = 36, mutter_id = 38 where id = 48;
update public.personen set vater_id = 36, mutter_id = 38 where id = 49;
update public.personen set vater_id = 54, mutter_id = NULL where id = 51;
update public.personen set vater_id = 51, mutter_id = 71 where id = 53;
update public.personen set vater_id = 50, mutter_id = NULL where id = 54;
update public.personen set vater_id = NULL, mutter_id = 33 where id = 56;
update public.personen set vater_id = NULL, mutter_id = 33 where id = 57;
update public.personen set vater_id = NULL, mutter_id = 33 where id = 58;
update public.personen set vater_id = NULL, mutter_id = 33 where id = 59;
update public.personen set vater_id = 6, mutter_id = 7 where id = 62;
update public.personen set vater_id = 24, mutter_id = 17 where id = 65;
update public.personen set vater_id = 65, mutter_id = 69 where id = 68;
update public.personen set vater_id = 16, mutter_id = 55 where id = 70;
update public.personen set vater_id = 72, mutter_id = 30 where id = 73;
update public.personen set vater_id = 72, mutter_id = 30 where id = 74;
update public.personen set vater_id = 72, mutter_id = 30 where id = 75;
update public.personen set vater_id = 78, mutter_id = 79 where id = 80;
update public.personen set vater_id = 82, mutter_id = 83 where id = 81;
update public.personen set vater_id = 80, mutter_id = 81 where id = 85;
update public.personen set vater_id = 80, mutter_id = 81 where id = 86;
update public.personen set vater_id = NULL, mutter_id = 81 where id = 87;
update public.personen set vater_id = 88, mutter_id = 89 where id = 90;
update public.personen set vater_id = 91, mutter_id = 92 where id = 93;
update public.personen set vater_id = 90, mutter_id = 93 where id = 94;
update public.personen set vater_id = 94, mutter_id = 95 where id = 96;
update public.personen set vater_id = 94, mutter_id = 98 where id = 99;
update public.personen set vater_id = 96, mutter_id = NULL where id = 100;
update public.personen set vater_id = NULL, mutter_id = 100 where id = 101;
update public.personen set vater_id = 6, mutter_id = 7 where id = 102;
update public.personen set vater_id = 6, mutter_id = 7 where id = 103;
update public.personen set vater_id = 6, mutter_id = 7 where id = 104;
update public.personen set vater_id = 90, mutter_id = 93 where id = 105;
update public.personen set vater_id = 90, mutter_id = 93 where id = 107;
update public.personen set vater_id = 103, mutter_id = 108 where id = 109;
update public.personen set vater_id = 109, mutter_id = NULL where id = 110;
update public.personen set vater_id = 109, mutter_id = NULL where id = 111;
update public.personen set vater_id = 109, mutter_id = NULL where id = 112;
update public.personen set vater_id = 103, mutter_id = 108 where id = 113;
update public.personen set vater_id = 113, mutter_id = 114 where id = 115;
update public.personen set vater_id = 113, mutter_id = 114 where id = 116;
update public.personen set vater_id = 103, mutter_id = 108 where id = 117;
update public.personen set vater_id = 117, mutter_id = 118 where id = 119;
update public.personen set vater_id = 117, mutter_id = 118 where id = 120;
update public.personen set vater_id = 117, mutter_id = 118 where id = 121;
update public.personen set vater_id = 117, mutter_id = 118 where id = 122;
update public.personen set vater_id = 117, mutter_id = 118 where id = 123;
update public.personen set vater_id = 103, mutter_id = 108 where id = 124;
update public.personen set vater_id = 124, mutter_id = 125 where id = 126;
update public.personen set vater_id = 124, mutter_id = 125 where id = 127;
update public.personen set vater_id = 103, mutter_id = 108 where id = 128;
update public.personen set vater_id = 129, mutter_id = 128 where id = 130;
update public.personen set vater_id = 129, mutter_id = 128 where id = 131;
update public.personen set vater_id = 129, mutter_id = 128 where id = 132;
update public.personen set vater_id = 103, mutter_id = 108 where id = 133;
update public.personen set vater_id = 134, mutter_id = 133 where id = 135;
update public.personen set vater_id = 134, mutter_id = 133 where id = 136;
update public.personen set vater_id = 134, mutter_id = 133 where id = 137;
update public.personen set vater_id = 134, mutter_id = 133 where id = 138;
update public.personen set vater_id = 103, mutter_id = 108 where id = 139;
update public.personen set vater_id = 139, mutter_id = 140 where id = 141;
update public.personen set vater_id = 103, mutter_id = 108 where id = 142;
update public.personen set vater_id = 143, mutter_id = 142 where id = 144;
update public.personen set vater_id = 143, mutter_id = 142 where id = 145;
update public.personen set vater_id = 143, mutter_id = 142 where id = 146;
update public.personen set vater_id = 143, mutter_id = 142 where id = 147;
update public.personen set vater_id = 148, mutter_id = 102 where id = 149;
update public.personen set vater_id = 150, mutter_id = 149 where id = 151;
update public.personen set vater_id = 150, mutter_id = 149 where id = 152;
update public.personen set vater_id = 148, mutter_id = 102 where id = 153;
update public.personen set vater_id = 153, mutter_id = 154 where id = 155;
update public.personen set vater_id = 153, mutter_id = 154 where id = 156;
update public.personen set vater_id = 148, mutter_id = 102 where id = 157;
update public.personen set vater_id = 158, mutter_id = 157 where id = 159;
update public.personen set vater_id = 158, mutter_id = 157 where id = 160;
update public.personen set vater_id = 148, mutter_id = 102 where id = 161;
update public.personen set vater_id = 161, mutter_id = 162 where id = 163;
update public.personen set vater_id = 161, mutter_id = 162 where id = 164;
update public.personen set vater_id = 161, mutter_id = 162 where id = 165;
update public.personen set vater_id = 161, mutter_id = 162 where id = 166;
update public.personen set vater_id = 148, mutter_id = 102 where id = 167;
update public.personen set vater_id = 168, mutter_id = 167 where id = 169;
update public.personen set vater_id = 168, mutter_id = 167 where id = 170;
update public.personen set vater_id = 148, mutter_id = 102 where id = 173;
update public.personen set vater_id = 173, mutter_id = 174 where id = 175;
update public.personen set vater_id = 173, mutter_id = 174 where id = 176;
update public.personen set vater_id = 173, mutter_id = 174 where id = 177;
update public.personen set vater_id = 148, mutter_id = 102 where id = 178;
update public.personen set vater_id = 148, mutter_id = 102 where id = 179;
update public.personen set vater_id = 180, mutter_id = 179 where id = 181;
update public.personen set vater_id = 180, mutter_id = 179 where id = 182;
update public.personen set vater_id = 180, mutter_id = 179 where id = 183;
update public.personen set vater_id = 180, mutter_id = 179 where id = 184;
update public.personen set vater_id = 148, mutter_id = 102 where id = 185;
update public.personen set vater_id = 186, mutter_id = 185 where id = 187;
update public.personen set vater_id = 186, mutter_id = 185 where id = 188;
update public.personen set vater_id = 186, mutter_id = 185 where id = 189;
update public.personen set vater_id = 148, mutter_id = 102 where id = 190;
update public.personen set vater_id = 148, mutter_id = 102 where id = 192;
update public.personen set vater_id = 193, mutter_id = 192 where id = 194;
update public.personen set vater_id = 193, mutter_id = 192 where id = 195;
update public.personen set vater_id = 193, mutter_id = 192 where id = 196;
update public.personen set vater_id = 148, mutter_id = 102 where id = 197;
update public.personen set vater_id = 198, mutter_id = 197 where id = 199;
update public.personen set vater_id = 198, mutter_id = 197 where id = 200;
update public.personen set vater_id = 201, mutter_id = 104 where id = 202;
update public.personen set vater_id = 201, mutter_id = 104 where id = 203;
update public.personen set vater_id = 204, mutter_id = 203 where id = 205;
update public.personen set vater_id = 204, mutter_id = 203 where id = 206;
update public.personen set vater_id = 204, mutter_id = 203 where id = 207;
update public.personen set vater_id = 201, mutter_id = 104 where id = 208;
update public.personen set vater_id = 201, mutter_id = 104 where id = 210;
update public.personen set vater_id = 211, mutter_id = 210 where id = 212;
update public.personen set vater_id = 211, mutter_id = 210 where id = 213;
