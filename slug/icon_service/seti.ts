//@ts-ignore
import setiWoffUrl from './seti.woff';
const styleText = `.seti-icon::before {
  content: attr(data-font-character);
  font-family: seti;
  margin: 0 4px;
  vertical-align: middle;
  width: 1em;
  height: 1em;
  font-size: 1.6em;
  display: inline-block;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}`;
const style = document.createElement('style');
style.innerHTML = styleText;
document.head.append(style);
const iconDefs = {
	"information_for_contributors": [
		"This file has been generated from data in https://github.com/jesseweed/seti-ui",
		"- icon definitions: https://github.com/jesseweed/seti-ui/blob/master/styles/_fonts/seti.less",
		"- icon colors: https://github.com/jesseweed/seti-ui/blob/master/styles/ui-variables.less",
		"- file associations: https://github.com/jesseweed/seti-ui/blob/master/styles/components/icons/mapping.less",
		"If you want to provide a fix or improvement, please create a pull request against the jesseweed/seti-ui repository.",
		"Once accepted there, we are happy to receive an update request."
	],
	"fonts": [
		{
			"id": "seti",
			"src": [
				{
					"path": "./seti.woff",
					"format": "woff"
				}
			],
			"weight": "normal",
			"style": "normal",
			"size": "150%"
		}
	],
	"iconDefinitions": {
		"_R_light": {
			"fontCharacter": "\uE001",
			"fontColor": "#498ba7"
		},
		"_R": {
			"fontCharacter": "\uE001",
			"fontColor": "#519aba"
		},
		"_argdown_light": {
			"fontCharacter": "\uE003",
			"fontColor": "#498ba7"
		},
		"_argdown": {
			"fontCharacter": "\uE003",
			"fontColor": "#519aba"
		},
		"_asm_light": {
			"fontCharacter": "\uE004",
			"fontColor": "#b8383d"
		},
		"_asm": {
			"fontCharacter": "\uE004",
			"fontColor": "#cc3e44"
		},
		"_audio_light": {
			"fontCharacter": "\uE005",
			"fontColor": "#9068b0"
		},
		"_audio": {
			"fontCharacter": "\uE005",
			"fontColor": "#a074c4"
		},
		"_babel_light": {
			"fontCharacter": "\uE006",
			"fontColor": "#b7b73b"
		},
		"_babel": {
			"fontCharacter": "\uE006",
			"fontColor": "#cbcb41"
		},
		"_bazel_light": {
			"fontCharacter": "\uE007",
			"fontColor": "#7fae42"
		},
		"_bazel": {
			"fontCharacter": "\uE007",
			"fontColor": "#8dc149"
		},
		"_bazel_1_light": {
			"fontCharacter": "\uE007",
			"fontColor": "#455155"
		},
		"_bazel_1": {
			"fontCharacter": "\uE007",
			"fontColor": "#4d5a5e"
		},
		"_bicep_light": {
			"fontCharacter": "\uE008",
			"fontColor": "#498ba7"
		},
		"_bicep": {
			"fontCharacter": "\uE008",
			"fontColor": "#519aba"
		},
		"_bower_light": {
			"fontCharacter": "\uE009",
			"fontColor": "#cc6d2e"
		},
		"_bower": {
			"fontCharacter": "\uE009",
			"fontColor": "#e37933"
		},
		"_bsl_light": {
			"fontCharacter": "\uE00A",
			"fontColor": "#b8383d"
		},
		"_bsl": {
			"fontCharacter": "\uE00A",
			"fontColor": "#cc3e44"
		},
		"_c_light": {
			"fontCharacter": "\uE00C",
			"fontColor": "#498ba7"
		},
		"_c": {
			"fontCharacter": "\uE00C",
			"fontColor": "#519aba"
		},
		"_c-sharp_light": {
			"fontCharacter": "\uE00B",
			"fontColor": "#498ba7"
		},
		"_c-sharp": {
			"fontCharacter": "\uE00B",
			"fontColor": "#519aba"
		},
		"_c_1_light": {
			"fontCharacter": "\uE00C",
			"fontColor": "#9068b0"
		},
		"_c_1": {
			"fontCharacter": "\uE00C",
			"fontColor": "#a074c4"
		},
		"_c_2_light": {
			"fontCharacter": "\uE00C",
			"fontColor": "#b7b73b"
		},
		"_c_2": {
			"fontCharacter": "\uE00C",
			"fontColor": "#cbcb41"
		},
		"_cake_light": {
			"fontCharacter": "\uE00D",
			"fontColor": "#b8383d"
		},
		"_cake": {
			"fontCharacter": "\uE00D",
			"fontColor": "#cc3e44"
		},
		"_cake_php_light": {
			"fontCharacter": "\uE00E",
			"fontColor": "#b8383d"
		},
		"_cake_php": {
			"fontCharacter": "\uE00E",
			"fontColor": "#cc3e44"
		},
		"_clock_light": {
			"fontCharacter": "\uE012",
			"fontColor": "#498ba7"
		},
		"_clock": {
			"fontCharacter": "\uE012",
			"fontColor": "#519aba"
		},
		"_clock_1_light": {
			"fontCharacter": "\uE012",
			"fontColor": "#627379"
		},
		"_clock_1": {
			"fontCharacter": "\uE012",
			"fontColor": "#6d8086"
		},
		"_clojure_light": {
			"fontCharacter": "\uE013",
			"fontColor": "#7fae42"
		},
		"_clojure": {
			"fontCharacter": "\uE013",
			"fontColor": "#8dc149"
		},
		"_clojure_1_light": {
			"fontCharacter": "\uE013",
			"fontColor": "#498ba7"
		},
		"_clojure_1": {
			"fontCharacter": "\uE013",
			"fontColor": "#519aba"
		},
		"_code-climate_light": {
			"fontCharacter": "\uE014",
			"fontColor": "#7fae42"
		},
		"_code-climate": {
			"fontCharacter": "\uE014",
			"fontColor": "#8dc149"
		},
		"_code-search_light": {
			"fontCharacter": "\uE015",
			"fontColor": "#9068b0"
		},
		"_code-search": {
			"fontCharacter": "\uE015",
			"fontColor": "#a074c4"
		},
		"_coffee_light": {
			"fontCharacter": "\uE016",
			"fontColor": "#b7b73b"
		},
		"_coffee": {
			"fontCharacter": "\uE016",
			"fontColor": "#cbcb41"
		},
		"_coldfusion_light": {
			"fontCharacter": "\uE018",
			"fontColor": "#498ba7"
		},
		"_coldfusion": {
			"fontCharacter": "\uE018",
			"fontColor": "#519aba"
		},
		"_config_light": {
			"fontCharacter": "\uE019",
			"fontColor": "#627379"
		},
		"_config": {
			"fontCharacter": "\uE019",
			"fontColor": "#6d8086"
		},
		"_cpp_light": {
			"fontCharacter": "\uE01A",
			"fontColor": "#498ba7"
		},
		"_cpp": {
			"fontCharacter": "\uE01A",
			"fontColor": "#519aba"
		},
		"_cpp_1_light": {
			"fontCharacter": "\uE01A",
			"fontColor": "#9068b0"
		},
		"_cpp_1": {
			"fontCharacter": "\uE01A",
			"fontColor": "#a074c4"
		},
		"_cpp_2_light": {
			"fontCharacter": "\uE01A",
			"fontColor": "#b7b73b"
		},
		"_cpp_2": {
			"fontCharacter": "\uE01A",
			"fontColor": "#cbcb41"
		},
		"_crystal_light": {
			"fontCharacter": "\uE01B",
			"fontColor": "#bfc2c1"
		},
		"_crystal": {
			"fontCharacter": "\uE01B",
			"fontColor": "#d4d7d6"
		},
		"_crystal_embedded_light": {
			"fontCharacter": "\uE01C",
			"fontColor": "#bfc2c1"
		},
		"_crystal_embedded": {
			"fontCharacter": "\uE01C",
			"fontColor": "#d4d7d6"
		},
		"_css_light": {
			"fontCharacter": "\uE01D",
			"fontColor": "#498ba7"
		},
		"_css": {
			"fontCharacter": "\uE01D",
			"fontColor": "#519aba"
		},
		"_csv_light": {
			"fontCharacter": "\uE01E",
			"fontColor": "#7fae42"
		},
		"_csv": {
			"fontCharacter": "\uE01E",
			"fontColor": "#8dc149"
		},
		"_cu_light": {
			"fontCharacter": "\uE01F",
			"fontColor": "#7fae42"
		},
		"_cu": {
			"fontCharacter": "\uE01F",
			"fontColor": "#8dc149"
		},
		"_cu_1_light": {
			"fontCharacter": "\uE01F",
			"fontColor": "#9068b0"
		},
		"_cu_1": {
			"fontCharacter": "\uE01F",
			"fontColor": "#a074c4"
		},
		"_d_light": {
			"fontCharacter": "\uE020",
			"fontColor": "#b8383d"
		},
		"_d": {
			"fontCharacter": "\uE020",
			"fontColor": "#cc3e44"
		},
		"_dart_light": {
			"fontCharacter": "\uE021",
			"fontColor": "#498ba7"
		},
		"_dart": {
			"fontCharacter": "\uE021",
			"fontColor": "#519aba"
		},
		"_db_light": {
			"fontCharacter": "\uE022",
			"fontColor": "#dd4b78"
		},
		"_db": {
			"fontCharacter": "\uE022",
			"fontColor": "#f55385"
		},
		"_db_1_light": {
			"fontCharacter": "\uE022",
			"fontColor": "#498ba7"
		},
		"_db_1": {
			"fontCharacter": "\uE022",
			"fontColor": "#519aba"
		},
		"_default_light": {
			"fontCharacter": "\uE023",
			"fontColor": "#bfc2c1"
		},
		"_default": {
			"fontCharacter": "\uE023",
			"fontColor": "#d4d7d6"
		},
		"_docker_light": {
			"fontCharacter": "\uE025",
			"fontColor": "#498ba7"
		},
		"_docker": {
			"fontCharacter": "\uE025",
			"fontColor": "#519aba"
		},
		"_docker_1_light": {
			"fontCharacter": "\uE025",
			"fontColor": "#455155"
		},
		"_docker_1": {
			"fontCharacter": "\uE025",
			"fontColor": "#4d5a5e"
		},
		"_docker_2_light": {
			"fontCharacter": "\uE025",
			"fontColor": "#7fae42"
		},
		"_docker_2": {
			"fontCharacter": "\uE025",
			"fontColor": "#8dc149"
		},
		"_docker_3_light": {
			"fontCharacter": "\uE025",
			"fontColor": "#dd4b78"
		},
		"_docker_3": {
			"fontCharacter": "\uE025",
			"fontColor": "#f55385"
		},
		"_ejs_light": {
			"fontCharacter": "\uE027",
			"fontColor": "#b7b73b"
		},
		"_ejs": {
			"fontCharacter": "\uE027",
			"fontColor": "#cbcb41"
		},
		"_elixir_light": {
			"fontCharacter": "\uE028",
			"fontColor": "#9068b0"
		},
		"_elixir": {
			"fontCharacter": "\uE028",
			"fontColor": "#a074c4"
		},
		"_elixir_script_light": {
			"fontCharacter": "\uE029",
			"fontColor": "#9068b0"
		},
		"_elixir_script": {
			"fontCharacter": "\uE029",
			"fontColor": "#a074c4"
		},
		"_elm_light": {
			"fontCharacter": "\uE02A",
			"fontColor": "#498ba7"
		},
		"_elm": {
			"fontCharacter": "\uE02A",
			"fontColor": "#519aba"
		},
		"_eslint_light": {
			"fontCharacter": "\uE02C",
			"fontColor": "#9068b0"
		},
		"_eslint": {
			"fontCharacter": "\uE02C",
			"fontColor": "#a074c4"
		},
		"_eslint_1_light": {
			"fontCharacter": "\uE02C",
			"fontColor": "#455155"
		},
		"_eslint_1": {
			"fontCharacter": "\uE02C",
			"fontColor": "#4d5a5e"
		},
		"_ethereum_light": {
			"fontCharacter": "\uE02D",
			"fontColor": "#498ba7"
		},
		"_ethereum": {
			"fontCharacter": "\uE02D",
			"fontColor": "#519aba"
		},
		"_f-sharp_light": {
			"fontCharacter": "\uE02E",
			"fontColor": "#498ba7"
		},
		"_f-sharp": {
			"fontCharacter": "\uE02E",
			"fontColor": "#519aba"
		},
		"_favicon_light": {
			"fontCharacter": "\uE02F",
			"fontColor": "#b7b73b"
		},
		"_favicon": {
			"fontCharacter": "\uE02F",
			"fontColor": "#cbcb41"
		},
		"_firebase_light": {
			"fontCharacter": "\uE030",
			"fontColor": "#cc6d2e"
		},
		"_firebase": {
			"fontCharacter": "\uE030",
			"fontColor": "#e37933"
		},
		"_firefox_light": {
			"fontCharacter": "\uE031",
			"fontColor": "#cc6d2e"
		},
		"_firefox": {
			"fontCharacter": "\uE031",
			"fontColor": "#e37933"
		},
		"_folder": {
			"fontCharacter": "\uE032",
			"fontColor": "#519aba"
		},
		"_font_light": {
			"fontCharacter": "\uE033",
			"fontColor": "#b8383d"
		},
		"_font": {
			"fontCharacter": "\uE033",
			"fontColor": "#cc3e44"
		},
		"_git_light": {
			"fontCharacter": "\uE034",
			"fontColor": "#3b4b52"
		},
		"_git": {
			"fontCharacter": "\uE034",
			"fontColor": "#41535b"
		},
		"_github_light": {
			"fontCharacter": "\uE037",
			"fontColor": "#bfc2c1"
		},
		"_github": {
			"fontCharacter": "\uE037",
			"fontColor": "#d4d7d6"
		},
		"_gitlab_light": {
			"fontCharacter": "\uE038",
			"fontColor": "#cc6d2e"
		},
		"_gitlab": {
			"fontCharacter": "\uE038",
			"fontColor": "#e37933"
		},
		"_go_light": {
			"fontCharacter": "\uE039",
			"fontColor": "#498ba7"
		},
		"_go": {
			"fontCharacter": "\uE039",
			"fontColor": "#519aba"
		},
		"_go2_light": {
			"fontCharacter": "\uE03A",
			"fontColor": "#498ba7"
		},
		"_go2": {
			"fontCharacter": "\uE03A",
			"fontColor": "#519aba"
		},
		"_godot_light": {
			"fontCharacter": "\uE03B",
			"fontColor": "#498ba7"
		},
		"_godot": {
			"fontCharacter": "\uE03B",
			"fontColor": "#519aba"
		},
		"_godot_1_light": {
			"fontCharacter": "\uE03B",
			"fontColor": "#b8383d"
		},
		"_godot_1": {
			"fontCharacter": "\uE03B",
			"fontColor": "#cc3e44"
		},
		"_godot_2_light": {
			"fontCharacter": "\uE03B",
			"fontColor": "#b7b73b"
		},
		"_godot_2": {
			"fontCharacter": "\uE03B",
			"fontColor": "#cbcb41"
		},
		"_godot_3_light": {
			"fontCharacter": "\uE03B",
			"fontColor": "#9068b0"
		},
		"_godot_3": {
			"fontCharacter": "\uE03B",
			"fontColor": "#a074c4"
		},
		"_gradle_light": {
			"fontCharacter": "\uE03C",
			"fontColor": "#498ba7"
		},
		"_gradle": {
			"fontCharacter": "\uE03C",
			"fontColor": "#519aba"
		},
		"_grails_light": {
			"fontCharacter": "\uE03D",
			"fontColor": "#7fae42"
		},
		"_grails": {
			"fontCharacter": "\uE03D",
			"fontColor": "#8dc149"
		},
		"_graphql_light": {
			"fontCharacter": "\uE03E",
			"fontColor": "#dd4b78"
		},
		"_graphql": {
			"fontCharacter": "\uE03E",
			"fontColor": "#f55385"
		},
		"_grunt_light": {
			"fontCharacter": "\uE03F",
			"fontColor": "#cc6d2e"
		},
		"_grunt": {
			"fontCharacter": "\uE03F",
			"fontColor": "#e37933"
		},
		"_gulp_light": {
			"fontCharacter": "\uE040",
			"fontColor": "#b8383d"
		},
		"_gulp": {
			"fontCharacter": "\uE040",
			"fontColor": "#cc3e44"
		},
		"_hacklang_light": {
			"fontCharacter": "\uE041",
			"fontColor": "#cc6d2e"
		},
		"_hacklang": {
			"fontCharacter": "\uE041",
			"fontColor": "#e37933"
		},
		"_haml_light": {
			"fontCharacter": "\uE042",
			"fontColor": "#b8383d"
		},
		"_haml": {
			"fontCharacter": "\uE042",
			"fontColor": "#cc3e44"
		},
		"_happenings_light": {
			"fontCharacter": "\uE043",
			"fontColor": "#498ba7"
		},
		"_happenings": {
			"fontCharacter": "\uE043",
			"fontColor": "#519aba"
		},
		"_haskell_light": {
			"fontCharacter": "\uE044",
			"fontColor": "#9068b0"
		},
		"_haskell": {
			"fontCharacter": "\uE044",
			"fontColor": "#a074c4"
		},
		"_haxe_light": {
			"fontCharacter": "\uE045",
			"fontColor": "#cc6d2e"
		},
		"_haxe": {
			"fontCharacter": "\uE045",
			"fontColor": "#e37933"
		},
		"_haxe_1_light": {
			"fontCharacter": "\uE045",
			"fontColor": "#b7b73b"
		},
		"_haxe_1": {
			"fontCharacter": "\uE045",
			"fontColor": "#cbcb41"
		},
		"_haxe_2_light": {
			"fontCharacter": "\uE045",
			"fontColor": "#498ba7"
		},
		"_haxe_2": {
			"fontCharacter": "\uE045",
			"fontColor": "#519aba"
		},
		"_haxe_3_light": {
			"fontCharacter": "\uE045",
			"fontColor": "#9068b0"
		},
		"_haxe_3": {
			"fontCharacter": "\uE045",
			"fontColor": "#a074c4"
		},
		"_heroku_light": {
			"fontCharacter": "\uE046",
			"fontColor": "#9068b0"
		},
		"_heroku": {
			"fontCharacter": "\uE046",
			"fontColor": "#a074c4"
		},
		"_hex_light": {
			"fontCharacter": "\uE047",
			"fontColor": "#b8383d"
		},
		"_hex": {
			"fontCharacter": "\uE047",
			"fontColor": "#cc3e44"
		},
		"_html_light": {
			"fontCharacter": "\uE048",
			"fontColor": "#498ba7"
		},
		"_html": {
			"fontCharacter": "\uE048",
			"fontColor": "#519aba"
		},
		"_html_1_light": {
			"fontCharacter": "\uE048",
			"fontColor": "#7fae42"
		},
		"_html_1": {
			"fontCharacter": "\uE048",
			"fontColor": "#8dc149"
		},
		"_html_2_light": {
			"fontCharacter": "\uE048",
			"fontColor": "#b7b73b"
		},
		"_html_2": {
			"fontCharacter": "\uE048",
			"fontColor": "#cbcb41"
		},
		"_html_3_light": {
			"fontCharacter": "\uE048",
			"fontColor": "#cc6d2e"
		},
		"_html_3": {
			"fontCharacter": "\uE048",
			"fontColor": "#e37933"
		},
		"_html_erb_light": {
			"fontCharacter": "\uE049",
			"fontColor": "#b8383d"
		},
		"_html_erb": {
			"fontCharacter": "\uE049",
			"fontColor": "#cc3e44"
		},
		"_ignored_light": {
			"fontCharacter": "\uE04A",
			"fontColor": "#3b4b52"
		},
		"_ignored": {
			"fontCharacter": "\uE04A",
			"fontColor": "#41535b"
		},
		"_illustrator_light": {
			"fontCharacter": "\uE04B",
			"fontColor": "#b7b73b"
		},
		"_illustrator": {
			"fontCharacter": "\uE04B",
			"fontColor": "#cbcb41"
		},
		"_image_light": {
			"fontCharacter": "\uE04C",
			"fontColor": "#9068b0"
		},
		"_image": {
			"fontCharacter": "\uE04C",
			"fontColor": "#a074c4"
		},
		"_info_light": {
			"fontCharacter": "\uE04D",
			"fontColor": "#498ba7"
		},
		"_info": {
			"fontCharacter": "\uE04D",
			"fontColor": "#519aba"
		},
		"_ionic_light": {
			"fontCharacter": "\uE04E",
			"fontColor": "#498ba7"
		},
		"_ionic": {
			"fontCharacter": "\uE04E",
			"fontColor": "#519aba"
		},
		"_jade_light": {
			"fontCharacter": "\uE04F",
			"fontColor": "#b8383d"
		},
		"_jade": {
			"fontCharacter": "\uE04F",
			"fontColor": "#cc3e44"
		},
		"_java_light": {
			"fontCharacter": "\uE050",
			"fontColor": "#b8383d"
		},
		"_java": {
			"fontCharacter": "\uE050",
			"fontColor": "#cc3e44"
		},
		"_java_1_light": {
			"fontCharacter": "\uE050",
			"fontColor": "#498ba7"
		},
		"_java_1": {
			"fontCharacter": "\uE050",
			"fontColor": "#519aba"
		},
		"_javascript_light": {
			"fontCharacter": "\uE051",
			"fontColor": "#b7b73b"
		},
		"_javascript": {
			"fontCharacter": "\uE051",
			"fontColor": "#cbcb41"
		},
		"_javascript_1_light": {
			"fontCharacter": "\uE051",
			"fontColor": "#cc6d2e"
		},
		"_javascript_1": {
			"fontCharacter": "\uE051",
			"fontColor": "#e37933"
		},
		"_javascript_2_light": {
			"fontCharacter": "\uE051",
			"fontColor": "#498ba7"
		},
		"_javascript_2": {
			"fontCharacter": "\uE051",
			"fontColor": "#519aba"
		},
		"_jenkins_light": {
			"fontCharacter": "\uE052",
			"fontColor": "#b8383d"
		},
		"_jenkins": {
			"fontCharacter": "\uE052",
			"fontColor": "#cc3e44"
		},
		"_jinja_light": {
			"fontCharacter": "\uE053",
			"fontColor": "#b8383d"
		},
		"_jinja": {
			"fontCharacter": "\uE053",
			"fontColor": "#cc3e44"
		},
		"_json_light": {
			"fontCharacter": "\uE055",
			"fontColor": "#b7b73b"
		},
		"_json": {
			"fontCharacter": "\uE055",
			"fontColor": "#cbcb41"
		},
		"_json_1_light": {
			"fontCharacter": "\uE055",
			"fontColor": "#7fae42"
		},
		"_json_1": {
			"fontCharacter": "\uE055",
			"fontColor": "#8dc149"
		},
		"_julia_light": {
			"fontCharacter": "\uE056",
			"fontColor": "#9068b0"
		},
		"_julia": {
			"fontCharacter": "\uE056",
			"fontColor": "#a074c4"
		},
		"_karma_light": {
			"fontCharacter": "\uE057",
			"fontColor": "#7fae42"
		},
		"_karma": {
			"fontCharacter": "\uE057",
			"fontColor": "#8dc149"
		},
		"_kotlin_light": {
			"fontCharacter": "\uE058",
			"fontColor": "#cc6d2e"
		},
		"_kotlin": {
			"fontCharacter": "\uE058",
			"fontColor": "#e37933"
		},
		"_less_light": {
			"fontCharacter": "\uE059",
			"fontColor": "#498ba7"
		},
		"_less": {
			"fontCharacter": "\uE059",
			"fontColor": "#519aba"
		},
		"_license_light": {
			"fontCharacter": "\uE05A",
			"fontColor": "#b7b73b"
		},
		"_license": {
			"fontCharacter": "\uE05A",
			"fontColor": "#cbcb41"
		},
		"_license_1_light": {
			"fontCharacter": "\uE05A",
			"fontColor": "#cc6d2e"
		},
		"_license_1": {
			"fontCharacter": "\uE05A",
			"fontColor": "#e37933"
		},
		"_license_2_light": {
			"fontCharacter": "\uE05A",
			"fontColor": "#b8383d"
		},
		"_license_2": {
			"fontCharacter": "\uE05A",
			"fontColor": "#cc3e44"
		},
		"_liquid_light": {
			"fontCharacter": "\uE05B",
			"fontColor": "#7fae42"
		},
		"_liquid": {
			"fontCharacter": "\uE05B",
			"fontColor": "#8dc149"
		},
		"_livescript_light": {
			"fontCharacter": "\uE05C",
			"fontColor": "#498ba7"
		},
		"_livescript": {
			"fontCharacter": "\uE05C",
			"fontColor": "#519aba"
		},
		"_lock_light": {
			"fontCharacter": "\uE05D",
			"fontColor": "#7fae42"
		},
		"_lock": {
			"fontCharacter": "\uE05D",
			"fontColor": "#8dc149"
		},
		"_lua_light": {
			"fontCharacter": "\uE05E",
			"fontColor": "#498ba7"
		},
		"_lua": {
			"fontCharacter": "\uE05E",
			"fontColor": "#519aba"
		},
		"_makefile_light": {
			"fontCharacter": "\uE05F",
			"fontColor": "#cc6d2e"
		},
		"_makefile": {
			"fontCharacter": "\uE05F",
			"fontColor": "#e37933"
		},
		"_makefile_1_light": {
			"fontCharacter": "\uE05F",
			"fontColor": "#9068b0"
		},
		"_makefile_1": {
			"fontCharacter": "\uE05F",
			"fontColor": "#a074c4"
		},
		"_makefile_2_light": {
			"fontCharacter": "\uE05F",
			"fontColor": "#627379"
		},
		"_makefile_2": {
			"fontCharacter": "\uE05F",
			"fontColor": "#6d8086"
		},
		"_makefile_3_light": {
			"fontCharacter": "\uE05F",
			"fontColor": "#498ba7"
		},
		"_makefile_3": {
			"fontCharacter": "\uE05F",
			"fontColor": "#519aba"
		},
		"_markdown_light": {
			"fontCharacter": "\uE060",
			"fontColor": "#498ba7"
		},
		"_markdown": {
			"fontCharacter": "\uE060",
			"fontColor": "#519aba"
		},
		"_maven_light": {
			"fontCharacter": "\uE061",
			"fontColor": "#b8383d"
		},
		"_maven": {
			"fontCharacter": "\uE061",
			"fontColor": "#cc3e44"
		},
		"_mdo_light": {
			"fontCharacter": "\uE062",
			"fontColor": "#b8383d"
		},
		"_mdo": {
			"fontCharacter": "\uE062",
			"fontColor": "#cc3e44"
		},
		"_mustache_light": {
			"fontCharacter": "\uE063",
			"fontColor": "#cc6d2e"
		},
		"_mustache": {
			"fontCharacter": "\uE063",
			"fontColor": "#e37933"
		},
		"_nim_light": {
			"fontCharacter": "\uE065",
			"fontColor": "#b7b73b"
		},
		"_nim": {
			"fontCharacter": "\uE065",
			"fontColor": "#cbcb41"
		},
		"_notebook_light": {
			"fontCharacter": "\uE066",
			"fontColor": "#498ba7"
		},
		"_notebook": {
			"fontCharacter": "\uE066",
			"fontColor": "#519aba"
		},
		"_npm_light": {
			"fontCharacter": "\uE067",
			"fontColor": "#3b4b52"
		},
		"_npm": {
			"fontCharacter": "\uE067",
			"fontColor": "#41535b"
		},
		"_npm_1_light": {
			"fontCharacter": "\uE067",
			"fontColor": "#b8383d"
		},
		"_npm_1": {
			"fontCharacter": "\uE067",
			"fontColor": "#cc3e44"
		},
		"_npm_ignored_light": {
			"fontCharacter": "\uE068",
			"fontColor": "#3b4b52"
		},
		"_npm_ignored": {
			"fontCharacter": "\uE068",
			"fontColor": "#41535b"
		},
		"_nunjucks_light": {
			"fontCharacter": "\uE069",
			"fontColor": "#7fae42"
		},
		"_nunjucks": {
			"fontCharacter": "\uE069",
			"fontColor": "#8dc149"
		},
		"_ocaml_light": {
			"fontCharacter": "\uE06A",
			"fontColor": "#cc6d2e"
		},
		"_ocaml": {
			"fontCharacter": "\uE06A",
			"fontColor": "#e37933"
		},
		"_odata_light": {
			"fontCharacter": "\uE06B",
			"fontColor": "#cc6d2e"
		},
		"_odata": {
			"fontCharacter": "\uE06B",
			"fontColor": "#e37933"
		},
		"_pddl_light": {
			"fontCharacter": "\uE06C",
			"fontColor": "#9068b0"
		},
		"_pddl": {
			"fontCharacter": "\uE06C",
			"fontColor": "#a074c4"
		},
		"_pdf_light": {
			"fontCharacter": "\uE06D",
			"fontColor": "#b8383d"
		},
		"_pdf": {
			"fontCharacter": "\uE06D",
			"fontColor": "#cc3e44"
		},
		"_perl_light": {
			"fontCharacter": "\uE06E",
			"fontColor": "#498ba7"
		},
		"_perl": {
			"fontCharacter": "\uE06E",
			"fontColor": "#519aba"
		},
		"_photoshop_light": {
			"fontCharacter": "\uE06F",
			"fontColor": "#498ba7"
		},
		"_photoshop": {
			"fontCharacter": "\uE06F",
			"fontColor": "#519aba"
		},
		"_php_light": {
			"fontCharacter": "\uE070",
			"fontColor": "#9068b0"
		},
		"_php": {
			"fontCharacter": "\uE070",
			"fontColor": "#a074c4"
		},
		"_pipeline_light": {
			"fontCharacter": "\uE071",
			"fontColor": "#cc6d2e"
		},
		"_pipeline": {
			"fontCharacter": "\uE071",
			"fontColor": "#e37933"
		},
		"_plan_light": {
			"fontCharacter": "\uE072",
			"fontColor": "#7fae42"
		},
		"_plan": {
			"fontCharacter": "\uE072",
			"fontColor": "#8dc149"
		},
		"_platformio_light": {
			"fontCharacter": "\uE073",
			"fontColor": "#cc6d2e"
		},
		"_platformio": {
			"fontCharacter": "\uE073",
			"fontColor": "#e37933"
		},
		"_powershell_light": {
			"fontCharacter": "\uE074",
			"fontColor": "#498ba7"
		},
		"_powershell": {
			"fontCharacter": "\uE074",
			"fontColor": "#519aba"
		},
		"_prisma_light": {
			"fontCharacter": "\uE075",
			"fontColor": "#498ba7"
		},
		"_prisma": {
			"fontCharacter": "\uE075",
			"fontColor": "#519aba"
		},
		"_prolog_light": {
			"fontCharacter": "\uE077",
			"fontColor": "#cc6d2e"
		},
		"_prolog": {
			"fontCharacter": "\uE077",
			"fontColor": "#e37933"
		},
		"_pug_light": {
			"fontCharacter": "\uE078",
			"fontColor": "#b8383d"
		},
		"_pug": {
			"fontCharacter": "\uE078",
			"fontColor": "#cc3e44"
		},
		"_puppet_light": {
			"fontCharacter": "\uE079",
			"fontColor": "#b7b73b"
		},
		"_puppet": {
			"fontCharacter": "\uE079",
			"fontColor": "#cbcb41"
		},
		"_purescript_light": {
			"fontCharacter": "\uE07A",
			"fontColor": "#bfc2c1"
		},
		"_purescript": {
			"fontCharacter": "\uE07A",
			"fontColor": "#d4d7d6"
		},
		"_python_light": {
			"fontCharacter": "\uE07B",
			"fontColor": "#498ba7"
		},
		"_python": {
			"fontCharacter": "\uE07B",
			"fontColor": "#519aba"
		},
		"_react_light": {
			"fontCharacter": "\uE07D",
			"fontColor": "#498ba7"
		},
		"_react": {
			"fontCharacter": "\uE07D",
			"fontColor": "#519aba"
		},
		"_react_1_light": {
			"fontCharacter": "\uE07D",
			"fontColor": "#cc6d2e"
		},
		"_react_1": {
			"fontCharacter": "\uE07D",
			"fontColor": "#e37933"
		},
		"_reasonml_light": {
			"fontCharacter": "\uE07E",
			"fontColor": "#b8383d"
		},
		"_reasonml": {
			"fontCharacter": "\uE07E",
			"fontColor": "#cc3e44"
		},
		"_rescript_light": {
			"fontCharacter": "\uE07F",
			"fontColor": "#b8383d"
		},
		"_rescript": {
			"fontCharacter": "\uE07F",
			"fontColor": "#cc3e44"
		},
		"_rescript_1_light": {
			"fontCharacter": "\uE07F",
			"fontColor": "#dd4b78"
		},
		"_rescript_1": {
			"fontCharacter": "\uE07F",
			"fontColor": "#f55385"
		},
		"_rollup_light": {
			"fontCharacter": "\uE080",
			"fontColor": "#b8383d"
		},
		"_rollup": {
			"fontCharacter": "\uE080",
			"fontColor": "#cc3e44"
		},
		"_ruby_light": {
			"fontCharacter": "\uE081",
			"fontColor": "#b8383d"
		},
		"_ruby": {
			"fontCharacter": "\uE081",
			"fontColor": "#cc3e44"
		},
		"_rust_light": {
			"fontCharacter": "\uE082",
			"fontColor": "#627379"
		},
		"_rust": {
			"fontCharacter": "\uE082",
			"fontColor": "#6d8086"
		},
		"_salesforce_light": {
			"fontCharacter": "\uE083",
			"fontColor": "#498ba7"
		},
		"_salesforce": {
			"fontCharacter": "\uE083",
			"fontColor": "#519aba"
		},
		"_sass_light": {
			"fontCharacter": "\uE084",
			"fontColor": "#dd4b78"
		},
		"_sass": {
			"fontCharacter": "\uE084",
			"fontColor": "#f55385"
		},
		"_sbt_light": {
			"fontCharacter": "\uE085",
			"fontColor": "#498ba7"
		},
		"_sbt": {
			"fontCharacter": "\uE085",
			"fontColor": "#519aba"
		},
		"_scala_light": {
			"fontCharacter": "\uE086",
			"fontColor": "#b8383d"
		},
		"_scala": {
			"fontCharacter": "\uE086",
			"fontColor": "#cc3e44"
		},
		"_shell_light": {
			"fontCharacter": "\uE089",
			"fontColor": "#7fae42"
		},
		"_shell": {
			"fontCharacter": "\uE089",
			"fontColor": "#8dc149"
		},
		"_slim_light": {
			"fontCharacter": "\uE08A",
			"fontColor": "#cc6d2e"
		},
		"_slim": {
			"fontCharacter": "\uE08A",
			"fontColor": "#e37933"
		},
		"_smarty_light": {
			"fontCharacter": "\uE08B",
			"fontColor": "#b7b73b"
		},
		"_smarty": {
			"fontCharacter": "\uE08B",
			"fontColor": "#cbcb41"
		},
		"_spring_light": {
			"fontCharacter": "\uE08C",
			"fontColor": "#7fae42"
		},
		"_spring": {
			"fontCharacter": "\uE08C",
			"fontColor": "#8dc149"
		},
		"_stylelint_light": {
			"fontCharacter": "\uE08D",
			"fontColor": "#bfc2c1"
		},
		"_stylelint": {
			"fontCharacter": "\uE08D",
			"fontColor": "#d4d7d6"
		},
		"_stylelint_1_light": {
			"fontCharacter": "\uE08D",
			"fontColor": "#455155"
		},
		"_stylelint_1": {
			"fontCharacter": "\uE08D",
			"fontColor": "#4d5a5e"
		},
		"_stylus_light": {
			"fontCharacter": "\uE08E",
			"fontColor": "#7fae42"
		},
		"_stylus": {
			"fontCharacter": "\uE08E",
			"fontColor": "#8dc149"
		},
		"_sublime_light": {
			"fontCharacter": "\uE08F",
			"fontColor": "#cc6d2e"
		},
		"_sublime": {
			"fontCharacter": "\uE08F",
			"fontColor": "#e37933"
		},
		"_svelte_light": {
			"fontCharacter": "\uE090",
			"fontColor": "#b8383d"
		},
		"_svelte": {
			"fontCharacter": "\uE090",
			"fontColor": "#cc3e44"
		},
		"_svg_light": {
			"fontCharacter": "\uE091",
			"fontColor": "#9068b0"
		},
		"_svg": {
			"fontCharacter": "\uE091",
			"fontColor": "#a074c4"
		},
		"_svg_1_light": {
			"fontCharacter": "\uE091",
			"fontColor": "#498ba7"
		},
		"_svg_1": {
			"fontCharacter": "\uE091",
			"fontColor": "#519aba"
		},
		"_swift_light": {
			"fontCharacter": "\uE092",
			"fontColor": "#cc6d2e"
		},
		"_swift": {
			"fontCharacter": "\uE092",
			"fontColor": "#e37933"
		},
		"_terraform_light": {
			"fontCharacter": "\uE093",
			"fontColor": "#9068b0"
		},
		"_terraform": {
			"fontCharacter": "\uE093",
			"fontColor": "#a074c4"
		},
		"_tex_light": {
			"fontCharacter": "\uE094",
			"fontColor": "#498ba7"
		},
		"_tex": {
			"fontCharacter": "\uE094",
			"fontColor": "#519aba"
		},
		"_tex_1_light": {
			"fontCharacter": "\uE094",
			"fontColor": "#b7b73b"
		},
		"_tex_1": {
			"fontCharacter": "\uE094",
			"fontColor": "#cbcb41"
		},
		"_tex_2_light": {
			"fontCharacter": "\uE094",
			"fontColor": "#cc6d2e"
		},
		"_tex_2": {
			"fontCharacter": "\uE094",
			"fontColor": "#e37933"
		},
		"_tex_3_light": {
			"fontCharacter": "\uE094",
			"fontColor": "#bfc2c1"
		},
		"_tex_3": {
			"fontCharacter": "\uE094",
			"fontColor": "#d4d7d6"
		},
		"_todo": {
			"fontCharacter": "\uE096"
		},
		"_tsconfig_light": {
			"fontCharacter": "\uE097",
			"fontColor": "#498ba7"
		},
		"_tsconfig": {
			"fontCharacter": "\uE097",
			"fontColor": "#519aba"
		},
		"_twig_light": {
			"fontCharacter": "\uE098",
			"fontColor": "#7fae42"
		},
		"_twig": {
			"fontCharacter": "\uE098",
			"fontColor": "#8dc149"
		},
		"_typescript_light": {
			"fontCharacter": "\uE099",
			"fontColor": "#498ba7"
		},
		"_typescript": {
			"fontCharacter": "\uE099",
			"fontColor": "#519aba"
		},
		"_typescript_1_light": {
			"fontCharacter": "\uE099",
			"fontColor": "#cc6d2e"
		},
		"_typescript_1": {
			"fontCharacter": "\uE099",
			"fontColor": "#e37933"
		},
		"_vala_light": {
			"fontCharacter": "\uE09A",
			"fontColor": "#627379"
		},
		"_vala": {
			"fontCharacter": "\uE09A",
			"fontColor": "#6d8086"
		},
		"_video_light": {
			"fontCharacter": "\uE09B",
			"fontColor": "#dd4b78"
		},
		"_video": {
			"fontCharacter": "\uE09B",
			"fontColor": "#f55385"
		},
		"_vue_light": {
			"fontCharacter": "\uE09C",
			"fontColor": "#7fae42"
		},
		"_vue": {
			"fontCharacter": "\uE09C",
			"fontColor": "#8dc149"
		},
		"_wasm_light": {
			"fontCharacter": "\uE09D",
			"fontColor": "#9068b0"
		},
		"_wasm": {
			"fontCharacter": "\uE09D",
			"fontColor": "#a074c4"
		},
		"_wat_light": {
			"fontCharacter": "\uE09E",
			"fontColor": "#9068b0"
		},
		"_wat": {
			"fontCharacter": "\uE09E",
			"fontColor": "#a074c4"
		},
		"_webpack_light": {
			"fontCharacter": "\uE09F",
			"fontColor": "#498ba7"
		},
		"_webpack": {
			"fontCharacter": "\uE09F",
			"fontColor": "#519aba"
		},
		"_wgt_light": {
			"fontCharacter": "\uE0A0",
			"fontColor": "#498ba7"
		},
		"_wgt": {
			"fontCharacter": "\uE0A0",
			"fontColor": "#519aba"
		},
		"_windows_light": {
			"fontCharacter": "\uE0A1",
			"fontColor": "#498ba7"
		},
		"_windows": {
			"fontCharacter": "\uE0A1",
			"fontColor": "#519aba"
		},
		"_word_light": {
			"fontCharacter": "\uE0A2",
			"fontColor": "#498ba7"
		},
		"_word": {
			"fontCharacter": "\uE0A2",
			"fontColor": "#519aba"
		},
		"_xls_light": {
			"fontCharacter": "\uE0A3",
			"fontColor": "#7fae42"
		},
		"_xls": {
			"fontCharacter": "\uE0A3",
			"fontColor": "#8dc149"
		},
		"_xml_light": {
			"fontCharacter": "\uE0A4",
			"fontColor": "#cc6d2e"
		},
		"_xml": {
			"fontCharacter": "\uE0A4",
			"fontColor": "#e37933"
		},
		"_yarn_light": {
			"fontCharacter": "\uE0A5",
			"fontColor": "#498ba7"
		},
		"_yarn": {
			"fontCharacter": "\uE0A5",
			"fontColor": "#519aba"
		},
		"_yml_light": {
			"fontCharacter": "\uE0A6",
			"fontColor": "#9068b0"
		},
		"_yml": {
			"fontCharacter": "\uE0A6",
			"fontColor": "#a074c4"
		},
		"_zig_light": {
			"fontCharacter": "\uE0A7",
			"fontColor": "#cc6d2e"
		},
		"_zig": {
			"fontCharacter": "\uE0A7",
			"fontColor": "#e37933"
		},
		"_zip_light": {
			"fontCharacter": "\uE0A8",
			"fontColor": "#b8383d"
		},
		"_zip": {
			"fontCharacter": "\uE0A8",
			"fontColor": "#cc3e44"
		},
		"_zip_1_light": {
			"fontCharacter": "\uE0A8",
			"fontColor": "#627379"
		},
		"_zip_1": {
			"fontCharacter": "\uE0A8",
			"fontColor": "#6d8086"
		}
	},
	"file": "_default",
	"fileExtensions": {
		"bsl": "_bsl",
		"mdo": "_mdo",
		"cls": "_salesforce",
		"apex": "_salesforce",
		"asm": "_asm",
		"s": "_asm",
		"bicep": "_bicep",
		"bzl": "_bazel",
		"bazel": "_bazel",
		"build": "_bazel",
		"workspace": "_bazel",
		"bazelignore": "_bazel",
		"bazelversion": "_bazel",
		"h": "_c_1",
		"aspx": "_html",
		"ascx": "_html_1",
		"asax": "_html_2",
		"master": "_html_2",
		"hh": "_cpp_1",
		"hpp": "_cpp_1",
		"hxx": "_cpp_1",
		"h++": "_cpp_1",
		"edn": "_clojure_1",
		"cfc": "_coldfusion",
		"cfm": "_coldfusion",
		"litcoffee": "_coffee",
		"config": "_config",
		"cfg": "_config",
		"conf": "_config",
		"cr": "_crystal",
		"ecr": "_crystal_embedded",
		"slang": "_crystal_embedded",
		"cson": "_json",
		"css.map": "_css",
		"sss": "_css",
		"csv": "_csv",
		"xls": "_xls",
		"xlsx": "_xls",
		"cuh": "_cu_1",
		"hu": "_cu_1",
		"cake": "_cake",
		"ctp": "_cake_php",
		"d": "_d",
		"doc": "_word",
		"docx": "_word",
		"ejs": "_ejs",
		"ex": "_elixir",
		"exs": "_elixir_script",
		"elm": "_elm",
		"ico": "_favicon",
		"gitconfig": "_git",
		"gitkeep": "_git",
		"gitattributes": "_git",
		"gitmodules": "_git",
		"slide": "_go",
		"article": "_go",
		"gd": "_godot",
		"godot": "_godot_1",
		"tres": "_godot_2",
		"tscn": "_godot_3",
		"gradle": "_gradle",
		"gsp": "_grails",
		"gql": "_graphql",
		"graphql": "_graphql",
		"graphqls": "_graphql",
		"hack": "_hacklang",
		"haml": "_haml",
		"hs": "_haskell",
		"lhs": "_haskell",
		"hx": "_haxe",
		"hxs": "_haxe_1",
		"hxp": "_haxe_2",
		"hxml": "_haxe_3",
		"jade": "_jade",
		"class": "_java_1",
		"classpath": "_java",
		"js.map": "_javascript",
		"spec.js": "_javascript_1",
		"test.js": "_javascript_1",
		"es": "_javascript",
		"es5": "_javascript",
		"es7": "_javascript",
		"jinja": "_jinja",
		"jinja2": "_jinja",
		"kt": "_kotlin",
		"kts": "_kotlin",
		"liquid": "_liquid",
		"ls": "_livescript",
		"argdown": "_argdown",
		"ad": "_argdown",
		"mustache": "_mustache",
		"stache": "_mustache",
		"nim": "_nim",
		"nims": "_nim",
		"github-issues": "_github",
		"ipynb": "_notebook",
		"njk": "_nunjucks",
		"nunjucks": "_nunjucks",
		"nunjs": "_nunjucks",
		"nunj": "_nunjucks",
		"njs": "_nunjucks",
		"nj": "_nunjucks",
		"npm-debug.log": "_npm",
		"npmignore": "_npm_1",
		"npmrc": "_npm_1",
		"ml": "_ocaml",
		"mli": "_ocaml",
		"cmx": "_ocaml",
		"cmxa": "_ocaml",
		"odata": "_odata",
		"php.inc": "_php",
		"pipeline": "_pipeline",
		"pddl": "_pddl",
		"plan": "_plan",
		"happenings": "_happenings",
		"prisma": "_prisma",
		"pp": "_puppet",
		"epp": "_puppet",
		"purs": "_purescript",
		"spec.jsx": "_react_1",
		"test.jsx": "_react_1",
		"cjsx": "_react",
		"spec.tsx": "_react_1",
		"test.tsx": "_react_1",
		"re": "_reasonml",
		"res": "_rescript",
		"resi": "_rescript_1",
		"r": "_R",
		"rmd": "_R",
		"erb": "_html_erb",
		"erb.html": "_html_erb",
		"html.erb": "_html_erb",
		"sass": "_sass",
		"springbeans": "_spring",
		"slim": "_slim",
		"smarty.tpl": "_smarty",
		"tpl": "_smarty",
		"sbt": "_sbt",
		"scala": "_scala",
		"sol": "_ethereum",
		"styl": "_stylus",
		"svelte": "_svelte",
		"soql": "_db_1",
		"tf": "_terraform",
		"tf.json": "_terraform",
		"tfvars": "_terraform",
		"tfvars.json": "_terraform",
		"dtx": "_tex_2",
		"ins": "_tex_3",
		"toml": "_config",
		"twig": "_twig",
		"spec.ts": "_typescript_1",
		"test.ts": "_typescript_1",
		"vala": "_vala",
		"vapi": "_vala",
		"component": "_html_3",
		"vue": "_vue",
		"wasm": "_wasm",
		"wat": "_wat",
		"pro": "_prolog",
		"zig": "_zig",
		"jar": "_zip",
		"zip": "_zip_1",
		"wgt": "_wgt",
		"ai": "_illustrator",
		"psd": "_photoshop",
		"pdf": "_pdf",
		"eot": "_font",
		"ttf": "_font",
		"woff": "_font",
		"woff2": "_font",
		"avif": "_image",
		"gif": "_image",
		"jpg": "_image",
		"jpeg": "_image",
		"png": "_image",
		"pxm": "_image",
		"svg": "_svg",
		"svgx": "_image",
		"tiff": "_image",
		"webp": "_image",
		"sublime-project": "_sublime",
		"sublime-workspace": "_sublime",
		"fish": "_shell",
		"mov": "_video",
		"ogv": "_video",
		"webm": "_video",
		"avi": "_video",
		"mpg": "_video",
		"mp4": "_video",
		"mp3": "_audio",
		"ogg": "_audio",
		"wav": "_audio",
		"flac": "_audio",
		"3ds": "_svg_1",
		"3dm": "_svg_1",
		"stl": "_svg_1",
		"obj": "_svg_1",
		"dae": "_svg_1",
		"babelrc": "_babel",
		"babelrc.js": "_babel",
		"babelrc.cjs": "_babel",
		"bazelrc": "_bazel_1",
		"bowerrc": "_bower",
		"dockerignore": "_docker_1",
		"codeclimate.yml": "_code-climate",
		"eslintrc": "_eslint",
		"eslintrc.js": "_eslint",
		"eslintrc.cjs": "_eslint",
		"eslintrc.yaml": "_eslint",
		"eslintrc.yml": "_eslint",
		"eslintrc.json": "_eslint",
		"eslintignore": "_eslint_1",
		"firebaserc": "_firebase",
		"gitlab-ci.yml": "_gitlab",
		"jshintrc": "_javascript_2",
		"jscsrc": "_javascript_2",
		"stylelintrc": "_stylelint",
		"stylelintrc.json": "_stylelint",
		"stylelintrc.yaml": "_stylelint",
		"stylelintrc.yml": "_stylelint",
		"stylelintrc.js": "_stylelint",
		"stylelintignore": "_stylelint_1",
		"direnv": "_config",
		"env": "_config",
		"static": "_config",
		"editorconfig": "_config",
		"slugignore": "_config",
		"tmp": "_clock_1",
		"htaccess": "_config",
		"key": "_lock",
		"cert": "_lock",
		"cer": "_lock",
		"crt": "_lock",
		"pem": "_lock",
		"ds_store": "_ignored"
	},
	"fileNames": {
		"mix": "_hex",
		"karma.conf.js": "_karma",
		"karma.conf.coffee": "_karma",
		"readme.md": "_info",
		"readme.txt": "_info",
		"readme": "_info",
		"changelog.md": "_clock",
		"changelog.txt": "_clock",
		"changelog": "_clock",
		"changes.md": "_clock",
		"changes.txt": "_clock",
		"changes": "_clock",
		"version.md": "_clock",
		"version.txt": "_clock",
		"version": "_clock",
		"mvnw": "_maven",
		"tsconfig.json": "_tsconfig",
		"swagger.json": "_json_1",
		"swagger.yml": "_json_1",
		"swagger.yaml": "_json_1",
		"mime.types": "_config",
		"jenkinsfile": "_jenkins",
		"babel.config.js": "_babel",
		"babel.config.json": "_babel",
		"babel.config.cjs": "_babel",
		"build": "_bazel",
		"build.bazel": "_bazel",
		"workspace": "_bazel",
		"workspace.bazel": "_bazel",
		"bower.json": "_bower",
		"docker-healthcheck": "_docker_2",
		"firebase.json": "_firebase",
		"geckodriver": "_firefox",
		"gruntfile.js": "_grunt",
		"gruntfile.babel.js": "_grunt",
		"gruntfile.coffee": "_grunt",
		"gulpfile": "_gulp",
		"gulpfile.js": "_gulp",
		"ionic.config.json": "_ionic",
		"ionic.project": "_ionic",
		"platformio.ini": "_platformio",
		"rollup.config.js": "_rollup",
		"sass-lint.yml": "_sass",
		"stylelint.config.js": "_stylelint",
		"stylelint.config.cjs": "_stylelint",
		"yarn.clean": "_yarn",
		"yarn.lock": "_yarn",
		"webpack.config.js": "_webpack",
		"webpack.config.cjs": "_webpack",
		"webpack.config.build.js": "_webpack",
		"webpack.config.build.cjs": "_webpack",
		"webpack.common.js": "_webpack",
		"webpack.common.cjs": "_webpack",
		"webpack.dev.js": "_webpack",
		"webpack.dev.cjs": "_webpack",
		"webpack.prod.js": "_webpack",
		"webpack.prod.cjs": "_webpack",
		"license": "_license",
		"licence": "_license",
		"license.txt": "_license",
		"licence.txt": "_license",
		"license.md": "_license",
		"licence.md": "_license",
		"copying": "_license",
		"copying.txt": "_license",
		"copying.md": "_license",
		"compiling": "_license_1",
		"compiling.txt": "_license_1",
		"compiling.md": "_license_1",
		"contributing": "_license_2",
		"contributing.txt": "_license_2",
		"contributing.md": "_license_2",
		"qmakefile": "_makefile_1",
		"omakefile": "_makefile_2",
		"cmakelists.txt": "_makefile_3",
		"procfile": "_heroku",
		"todo": "_todo",
		"todo.txt": "_todo",
		"todo.md": "_todo",
		"npm-debug.log": "_npm_ignored"
	},
	"languageIds": {
		"bat": "_windows",
		"clojure": "_clojure",
		"coffeescript": "_coffee",
		"jsonc": "_json",
		"json": "_json",
		"c": "_c",
		"cpp": "_cpp",
		"cuda-cpp": "_cu",
		"csharp": "_c-sharp",
		"css": "_css",
		"dart": "_dart",
		"dockerfile": "_docker",
		"ignore": "_git",
		"fsharp": "_f-sharp",
		"git-commit": "_git",
		"go": "_go2",
		"groovy": "_grails",
		"handlebars": "_mustache",
		"html": "_html_3",
		"properties": "_java",
		"java": "_java",
		"javascriptreact": "_react",
		"javascript": "_javascript",
		"julia": "_julia",
		"tex": "_tex_1",
		"latex": "_tex",
		"less": "_less",
		"lua": "_lua",
		"makefile": "_makefile",
		"markdown": "_markdown",
		"objective-c": "_c_2",
		"objective-cpp": "_cpp_2",
		"perl": "_perl",
		"php": "_php",
		"powershell": "_powershell",
		"jade": "_pug",
		"python": "_python",
		"r": "_R",
		"razor": "_html",
		"ruby": "_ruby",
		"rust": "_rust",
		"scss": "_sass",
		"search-result": "_code-search",
		"shellscript": "_shell",
		"sql": "_db",
		"swift": "_swift",
		"typescript": "_typescript",
		"typescriptreact": "_typescript",
		"xml": "_xml",
		"dockercompose": "_docker_3",
		"yaml": "_yml",
		"argdown": "_argdown",
		"bicep": "_bicep",
		"elixir": "_elixir",
		"elm": "_elm",
		"erb": "_html_erb",
		"github-issues": "_github",
		"gradle": "_gradle",
		"godot": "_godot",
		"haml": "_haml",
		"haskell": "_haskell",
		"haxe": "_haxe",
		"jinja": "_jinja",
		"kotlin": "_kotlin",
		"mustache": "_mustache",
		"nunjucks": "_nunjucks",
		"ocaml": "_ocaml",
		"rescript": "_rescript",
		"sass": "_sass",
		"stylus": "_stylus",
		"terraform": "_terraform",
		"todo": "_todo",
		"vala": "_vala",
		"vue": "_vue",
		"postcss": "_css",
		"django-html": "_html_3",
		"blade": "_php"
	},
	"light": {
		"file": "_default_light",
		"fileExtensions": {
			"bsl": "_bsl_light",
			"mdo": "_mdo_light",
			"cls": "_salesforce_light",
			"apex": "_salesforce_light",
			"asm": "_asm_light",
			"s": "_asm_light",
			"bicep": "_bicep_light",
			"bzl": "_bazel_light",
			"bazel": "_bazel_light",
			"build": "_bazel_light",
			"workspace": "_bazel_light",
			"bazelignore": "_bazel_light",
			"bazelversion": "_bazel_light",
			"h": "_c_1_light",
			"aspx": "_html_light",
			"ascx": "_html_1_light",
			"asax": "_html_2_light",
			"master": "_html_2_light",
			"hh": "_cpp_1_light",
			"hpp": "_cpp_1_light",
			"hxx": "_cpp_1_light",
			"h++": "_cpp_1_light",
			"edn": "_clojure_1_light",
			"cfc": "_coldfusion_light",
			"cfm": "_coldfusion_light",
			"litcoffee": "_coffee_light",
			"config": "_config_light",
			"cfg": "_config_light",
			"conf": "_config_light",
			"cr": "_crystal_light",
			"ecr": "_crystal_embedded_light",
			"slang": "_crystal_embedded_light",
			"cson": "_json_light",
			"css.map": "_css_light",
			"sss": "_css_light",
			"csv": "_csv_light",
			"xls": "_xls_light",
			"xlsx": "_xls_light",
			"cuh": "_cu_1_light",
			"hu": "_cu_1_light",
			"cake": "_cake_light",
			"ctp": "_cake_php_light",
			"d": "_d_light",
			"doc": "_word_light",
			"docx": "_word_light",
			"ejs": "_ejs_light",
			"ex": "_elixir_light",
			"exs": "_elixir_script_light",
			"elm": "_elm_light",
			"ico": "_favicon_light",
			"gitconfig": "_git_light",
			"gitkeep": "_git_light",
			"gitattributes": "_git_light",
			"gitmodules": "_git_light",
			"slide": "_go_light",
			"article": "_go_light",
			"gd": "_godot_light",
			"godot": "_godot_1_light",
			"tres": "_godot_2_light",
			"tscn": "_godot_3_light",
			"gradle": "_gradle_light",
			"gsp": "_grails_light",
			"gql": "_graphql_light",
			"graphql": "_graphql_light",
			"graphqls": "_graphql_light",
			"hack": "_hacklang_light",
			"haml": "_haml_light",
			"hs": "_haskell_light",
			"lhs": "_haskell_light",
			"hx": "_haxe_light",
			"hxs": "_haxe_1_light",
			"hxp": "_haxe_2_light",
			"hxml": "_haxe_3_light",
			"jade": "_jade_light",
			"class": "_java_1_light",
			"classpath": "_java_light",
			"js.map": "_javascript_light",
			"spec.js": "_javascript_1_light",
			"test.js": "_javascript_1_light",
			"es": "_javascript_light",
			"es5": "_javascript_light",
			"es7": "_javascript_light",
			"jinja": "_jinja_light",
			"jinja2": "_jinja_light",
			"kt": "_kotlin_light",
			"kts": "_kotlin_light",
			"liquid": "_liquid_light",
			"ls": "_livescript_light",
			"argdown": "_argdown_light",
			"ad": "_argdown_light",
			"mustache": "_mustache_light",
			"stache": "_mustache_light",
			"nim": "_nim_light",
			"nims": "_nim_light",
			"github-issues": "_github_light",
			"ipynb": "_notebook_light",
			"njk": "_nunjucks_light",
			"nunjucks": "_nunjucks_light",
			"nunjs": "_nunjucks_light",
			"nunj": "_nunjucks_light",
			"njs": "_nunjucks_light",
			"nj": "_nunjucks_light",
			"npm-debug.log": "_npm_light",
			"npmignore": "_npm_1_light",
			"npmrc": "_npm_1_light",
			"ml": "_ocaml_light",
			"mli": "_ocaml_light",
			"cmx": "_ocaml_light",
			"cmxa": "_ocaml_light",
			"odata": "_odata_light",
			"php.inc": "_php_light",
			"pipeline": "_pipeline_light",
			"pddl": "_pddl_light",
			"plan": "_plan_light",
			"happenings": "_happenings_light",
			"prisma": "_prisma_light",
			"pp": "_puppet_light",
			"epp": "_puppet_light",
			"purs": "_purescript_light",
			"spec.jsx": "_react_1_light",
			"test.jsx": "_react_1_light",
			"cjsx": "_react_light",
			"spec.tsx": "_react_1_light",
			"test.tsx": "_react_1_light",
			"re": "_reasonml_light",
			"res": "_rescript_light",
			"resi": "_rescript_1_light",
			"r": "_R_light",
			"rmd": "_R_light",
			"erb": "_html_erb_light",
			"erb.html": "_html_erb_light",
			"html.erb": "_html_erb_light",
			"sass": "_sass_light",
			"springbeans": "_spring_light",
			"slim": "_slim_light",
			"smarty.tpl": "_smarty_light",
			"tpl": "_smarty_light",
			"sbt": "_sbt_light",
			"scala": "_scala_light",
			"sol": "_ethereum_light",
			"styl": "_stylus_light",
			"svelte": "_svelte_light",
			"soql": "_db_1_light",
			"tf": "_terraform_light",
			"tf.json": "_terraform_light",
			"tfvars": "_terraform_light",
			"tfvars.json": "_terraform_light",
			"dtx": "_tex_2_light",
			"ins": "_tex_3_light",
			"toml": "_config_light",
			"twig": "_twig_light",
			"spec.ts": "_typescript_1_light",
			"test.ts": "_typescript_1_light",
			"vala": "_vala_light",
			"vapi": "_vala_light",
			"component": "_html_3_light",
			"vue": "_vue_light",
			"wasm": "_wasm_light",
			"wat": "_wat_light",
			"pro": "_prolog_light",
			"zig": "_zig_light",
			"jar": "_zip_light",
			"zip": "_zip_1_light",
			"wgt": "_wgt_light",
			"ai": "_illustrator_light",
			"psd": "_photoshop_light",
			"pdf": "_pdf_light",
			"eot": "_font_light",
			"ttf": "_font_light",
			"woff": "_font_light",
			"woff2": "_font_light",
			"avif": "_image_light",
			"gif": "_image_light",
			"jpg": "_image_light",
			"jpeg": "_image_light",
			"png": "_image_light",
			"pxm": "_image_light",
			"svg": "_svg_light",
			"svgx": "_image_light",
			"tiff": "_image_light",
			"webp": "_image_light",
			"sublime-project": "_sublime_light",
			"sublime-workspace": "_sublime_light",
			"fish": "_shell_light",
			"mov": "_video_light",
			"ogv": "_video_light",
			"webm": "_video_light",
			"avi": "_video_light",
			"mpg": "_video_light",
			"mp4": "_video_light",
			"mp3": "_audio_light",
			"ogg": "_audio_light",
			"wav": "_audio_light",
			"flac": "_audio_light",
			"3ds": "_svg_1_light",
			"3dm": "_svg_1_light",
			"stl": "_svg_1_light",
			"obj": "_svg_1_light",
			"dae": "_svg_1_light",
			"babelrc": "_babel_light",
			"babelrc.js": "_babel_light",
			"babelrc.cjs": "_babel_light",
			"bazelrc": "_bazel_1_light",
			"bowerrc": "_bower_light",
			"dockerignore": "_docker_1_light",
			"codeclimate.yml": "_code-climate_light",
			"eslintrc": "_eslint_light",
			"eslintrc.js": "_eslint_light",
			"eslintrc.cjs": "_eslint_light",
			"eslintrc.yaml": "_eslint_light",
			"eslintrc.yml": "_eslint_light",
			"eslintrc.json": "_eslint_light",
			"eslintignore": "_eslint_1_light",
			"firebaserc": "_firebase_light",
			"gitlab-ci.yml": "_gitlab_light",
			"jshintrc": "_javascript_2_light",
			"jscsrc": "_javascript_2_light",
			"stylelintrc": "_stylelint_light",
			"stylelintrc.json": "_stylelint_light",
			"stylelintrc.yaml": "_stylelint_light",
			"stylelintrc.yml": "_stylelint_light",
			"stylelintrc.js": "_stylelint_light",
			"stylelintignore": "_stylelint_1_light",
			"direnv": "_config_light",
			"env": "_config_light",
			"static": "_config_light",
			"editorconfig": "_config_light",
			"slugignore": "_config_light",
			"tmp": "_clock_1_light",
			"htaccess": "_config_light",
			"key": "_lock_light",
			"cert": "_lock_light",
			"cer": "_lock_light",
			"crt": "_lock_light",
			"pem": "_lock_light",
			"ds_store": "_ignored_light"
		},
		"languageIds": {
			"bat": "_windows_light",
			"clojure": "_clojure_light",
			"coffeescript": "_coffee_light",
			"jsonc": "_json_light",
			"json": "_json_light",
			"c": "_c_light",
			"cpp": "_cpp_light",
			"cuda-cpp": "_cu_light",
			"csharp": "_c-sharp_light",
			"css": "_css_light",
			"dart": "_dart_light",
			"dockerfile": "_docker_light",
			"ignore": "_git_light",
			"fsharp": "_f-sharp_light",
			"git-commit": "_git_light",
			"go": "_go2_light",
			"groovy": "_grails_light",
			"handlebars": "_mustache_light",
			"html": "_html_3_light",
			"properties": "_java_light",
			"java": "_java_light",
			"javascriptreact": "_react_light",
			"javascript": "_javascript_light",
			"julia": "_julia_light",
			"tex": "_tex_1_light",
			"latex": "_tex_light",
			"less": "_less_light",
			"lua": "_lua_light",
			"makefile": "_makefile_light",
			"markdown": "_markdown_light",
			"objective-c": "_c_2_light",
			"objective-cpp": "_cpp_2_light",
			"perl": "_perl_light",
			"php": "_php_light",
			"powershell": "_powershell_light",
			"jade": "_pug_light",
			"python": "_python_light",
			"r": "_R_light",
			"razor": "_html_light",
			"ruby": "_ruby_light",
			"rust": "_rust_light",
			"scss": "_sass_light",
			"search-result": "_code-search_light",
			"shellscript": "_shell_light",
			"sql": "_db_light",
			"swift": "_swift_light",
			"typescript": "_typescript_light",
			"typescriptreact": "_typescript_light",
			"xml": "_xml_light",
			"dockercompose": "_docker_3_light",
			"yaml": "_yml_light",
			"argdown": "_argdown_light",
			"bicep": "_bicep_light",
			"elixir": "_elixir_light",
			"elm": "_elm_light",
			"erb": "_html_erb_light",
			"github-issues": "_github_light",
			"gradle": "_gradle_light",
			"godot": "_godot_light",
			"haml": "_haml_light",
			"haskell": "_haskell_light",
			"haxe": "_haxe_light",
			"jinja": "_jinja_light",
			"kotlin": "_kotlin_light",
			"mustache": "_mustache_light",
			"nunjucks": "_nunjucks_light",
			"ocaml": "_ocaml_light",
			"rescript": "_rescript_light",
			"sass": "_sass_light",
			"stylus": "_stylus_light",
			"terraform": "_terraform_light",
			"vala": "_vala_light",
			"vue": "_vue_light",
			"postcss": "_css_light",
			"django-html": "_html_3_light",
			"blade": "_php_light"
		},
		"fileNames": {
			"mix": "_hex_light",
			"karma.conf.js": "_karma_light",
			"karma.conf.coffee": "_karma_light",
			"readme.md": "_info_light",
			"readme.txt": "_info_light",
			"readme": "_info_light",
			"changelog.md": "_clock_light",
			"changelog.txt": "_clock_light",
			"changelog": "_clock_light",
			"changes.md": "_clock_light",
			"changes.txt": "_clock_light",
			"changes": "_clock_light",
			"version.md": "_clock_light",
			"version.txt": "_clock_light",
			"version": "_clock_light",
			"mvnw": "_maven_light",
			"tsconfig.json": "_tsconfig_light",
			"swagger.json": "_json_1_light",
			"swagger.yml": "_json_1_light",
			"swagger.yaml": "_json_1_light",
			"mime.types": "_config_light",
			"jenkinsfile": "_jenkins_light",
			"babel.config.js": "_babel_light",
			"babel.config.json": "_babel_light",
			"babel.config.cjs": "_babel_light",
			"build": "_bazel_light",
			"build.bazel": "_bazel_light",
			"workspace": "_bazel_light",
			"workspace.bazel": "_bazel_light",
			"bower.json": "_bower_light",
			"docker-healthcheck": "_docker_2_light",
			"firebase.json": "_firebase_light",
			"geckodriver": "_firefox_light",
			"gruntfile.js": "_grunt_light",
			"gruntfile.babel.js": "_grunt_light",
			"gruntfile.coffee": "_grunt_light",
			"gulpfile": "_gulp_light",
			"gulpfile.js": "_gulp_light",
			"ionic.config.json": "_ionic_light",
			"ionic.project": "_ionic_light",
			"platformio.ini": "_platformio_light",
			"rollup.config.js": "_rollup_light",
			"sass-lint.yml": "_sass_light",
			"stylelint.config.js": "_stylelint_light",
			"stylelint.config.cjs": "_stylelint_light",
			"yarn.clean": "_yarn_light",
			"yarn.lock": "_yarn_light",
			"webpack.config.js": "_webpack_light",
			"webpack.config.cjs": "_webpack_light",
			"webpack.config.build.js": "_webpack_light",
			"webpack.config.build.cjs": "_webpack_light",
			"webpack.common.js": "_webpack_light",
			"webpack.common.cjs": "_webpack_light",
			"webpack.dev.js": "_webpack_light",
			"webpack.dev.cjs": "_webpack_light",
			"webpack.prod.js": "_webpack_light",
			"webpack.prod.cjs": "_webpack_light",
			"license": "_license_light",
			"licence": "_license_light",
			"license.txt": "_license_light",
			"licence.txt": "_license_light",
			"license.md": "_license_light",
			"licence.md": "_license_light",
			"copying": "_license_light",
			"copying.txt": "_license_light",
			"copying.md": "_license_light",
			"compiling": "_license_1_light",
			"compiling.txt": "_license_1_light",
			"compiling.md": "_license_1_light",
			"contributing": "_license_2_light",
			"contributing.txt": "_license_2_light",
			"contributing.md": "_license_2_light",
			"qmakefile": "_makefile_1_light",
			"omakefile": "_makefile_2_light",
			"cmakelists.txt": "_makefile_3_light",
			"procfile": "_heroku_light",
			"npm-debug.log": "_npm_ignored_light"
		}
	},
	"version": "https://github.com/jesseweed/seti-ui/commit/2d10473b7575ec00c47eda751ea9caeec6b0b606"
}

const extensionToLanguage = {
  ".txt": "plaintext",
  ".bat": "bat",
  ".cmd": "bat",
  ".clj": "clojure",
  ".cljs": "clojure",
  ".cljc": "clojure",
  ".cljx": "clojure",
  ".clojure": "clojure",
  ".edn": "clojure",
  ".coffee": "coffeescript",
  ".cson": "coffeescript",
  ".iced": "coffeescript",
  ".code-workspace": "jsonc",
  ".code-snippets": "jsonc",
  ".code-profile": "json",
  ".c": "c",
  ".i": "c",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".c++": "cpp",
  ".hpp": "cpp",
  ".hh": "cpp",
  ".hxx": "cpp",
  ".h++": "cpp",
  ".h": "cpp",
  ".ii": "cpp",
  ".ino": "cpp",
  ".inl": "cpp",
  ".ipp": "cpp",
  ".ixx": "cpp",
  ".tpp": "cpp",
  ".txx": "cpp",
  ".hpp.in": "cpp",
  ".h.in": "cpp",
  ".cu": "cuda-cpp",
  ".cuh": "cuda-cpp",
  ".cs": "csharp",
  ".csx": "csharp",
  ".cake": "csharp",
  ".css": "css",
  ".dart": "dart",
  ".diff": "diff",
  ".patch": "diff",
  ".rej": "diff",
  ".dockerfile": "dockerfile",
  ".containerfile": "dockerfile",
  ".fs": "fsharp",
  ".fsi": "fsharp",
  ".fsx": "fsharp",
  ".fsscript": "fsharp",
  ".gitignore_global": "ignore",
  ".gitignore": "ignore",
  ".go": "go",
  ".groovy": "groovy",
  ".gvy": "groovy",
  ".gradle": "groovy",
  ".jenkinsfile": "groovy",
  ".nf": "groovy",
  ".handlebars": "handlebars",
  ".hbs": "handlebars",
  ".hjs": "handlebars",
  ".hlsl": "hlsl",
  ".hlsli": "hlsl",
  ".fx": "hlsl",
  ".fxh": "hlsl",
  ".vsh": "hlsl",
  ".psh": "hlsl",
  ".cginc": "hlsl",
  ".compute": "hlsl",
  ".html": "html",
  ".htm": "html",
  ".shtml": "html",
  ".xhtml": "html",
  ".xht": "html",
  ".mdoc": "html",
  ".jsp": "html",
  ".asp": "html",
  ".aspx": "html",
  ".jshtm": "html",
  ".volt": "html",
  ".ejs": "html",
  ".rhtml": "html",
  ".ini": "ini",
  ".properties": "properties",
  ".cfg": "properties",
  ".conf": "nginx",
  ".directory": "properties",
  ".gitattributes": "properties",
  ".gitconfig": "properties",
  ".gitmodules": "properties",
  ".editorconfig": "properties",
  ".java": "java",
  ".jav": "java",
  ".jsx": "javascriptreact",
  ".js": "javascript",
  ".es6": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".pac": "javascript",
  ".json": "json",
  ".bowerrc": "json",
  ".jscsrc": "json",
  ".webmanifest": "json",
  ".js.map": "json",
  ".css.map": "json",
  ".ts.map": "json",
  ".har": "json",
  ".jslintrc": "json",
  ".jsonld": "json",
  ".geojson": "json",
  ".ipynb": "json",
  ".jsonc": "jsonc",
  ".eslintrc": "jsonc",
  ".eslintrc.json": "jsonc",
  ".jsfmtrc": "jsonc",
  ".jshintrc": "jsonc",
  ".swcrc": "jsonc",
  ".hintrc": "jsonc",
  ".babelrc": "jsonc",
  ".jl": "julia",
  ".jmd": "juliamarkdown",
  ".sty": "tex",
  ".cls": "tex",
  ".bbx": "tex",
  ".cbx": "tex",
  ".tex": "latex",
  ".ltx": "latex",
  ".ctx": "latex",
  ".bib": "bibtex",
  ".less": "less",
  ".log": "log",
  ".lua": "lua",
  ".mak": "makefile",
  ".mk": "makefile",
  ".md": "markdown",
  ".mkd": "markdown",
  ".mdwn": "markdown",
  ".mdown": "markdown",
  ".markdown": "markdown",
  ".markdn": "markdown",
  ".mdtxt": "markdown",
  ".mdtext": "markdown",
  ".workbook": "markdown",
  ".npmignore": "ignore",
  ".npmrc": "properties",
  ".m": "objective-c",
  ".mm": "objective-cpp",
  ".pl": "perl",
  ".pm": "perl",
  ".pod": "perl",
  ".t": "perl",
  ".PL": "perl",
  ".psgi": "perl",
  ".p6": "perl6",
  ".pl6": "perl6",
  ".pm6": "perl6",
  ".nqp": "perl6",
  ".php": "php",
  ".php4": "php",
  ".php5": "php",
  ".phtml": "php",
  ".ctp": "php",
  ".ps1": "powershell",
  ".psm1": "powershell",
  ".psd1": "powershell",
  ".pssc": "powershell",
  ".psrc": "powershell",
  ".pug": "jade",
  ".jade": "jade",
  ".py": "python",
  ".rpy": "python",
  ".pyw": "python",
  ".cpy": "python",
  ".gyp": "python",
  ".gypi": "python",
  ".pyi": "python",
  ".ipy": "python",
  ".pyt": "python",
  ".r": "r",
  ".rhistory": "r",
  ".rprofile": "r",
  ".rt": "r",
  ".cshtml": "aspnetcorerazor",
  ".razor": "aspnetcorerazor",
  ".rst": "restructuredtext",
  ".rb": "ruby",
  ".rbx": "ruby",
  ".rjs": "ruby",
  ".gemspec": "ruby",
  ".rake": "ruby",
  ".ru": "ruby",
  ".erb": "ruby",
  ".podspec": "ruby",
  ".rbi": "ruby",
  ".rs": "rust",
  ".scss": "scss",
  ".code-search": "search-result",
  ".shader": "shaderlab",
  ".sh": "shellscript",
  ".bash": "shellscript",
  ".bashrc": "shellscript",
  ".bash_aliases": "shellscript",
  ".bash_profile": "shellscript",
  ".bash_login": "shellscript",
  ".ebuild": "shellscript",
  ".profile": "shellscript",
  ".bash_logout": "shellscript",
  ".xprofile": "shellscript",
  ".xsession": "shellscript",
  ".xsessionrc": "shellscript",
  ".Xsession": "shellscript",
  ".zsh": "shellscript",
  ".zshrc": "shellscript",
  ".zprofile": "shellscript",
  ".zlogin": "shellscript",
  ".zlogout": "shellscript",
  ".zshenv": "shellscript",
  ".zsh-theme": "shellscript",
  ".ksh": "shellscript",
  ".csh": "shellscript",
  ".cshrc": "shellscript",
  ".tcshrc": "shellscript",
  ".yashrc": "shellscript",
  ".yash_profile": "shellscript",
  ".sql": "sql",
  ".dsql": "sql",
  ".swift": "swift",
  ".ts": "typescript",
  ".cts": "typescript",
  ".mts": "typescript",
  ".tsx": "typescriptreact",
  ".vb": "vb",
  ".brs": "vb",
  ".vbs": "vb",
  ".bas": "vb",
  ".vba": "vb",
  ".xml": "xml",
  ".xsd": "xml",
  ".ascx": "xml",
  ".atom": "xml",
  ".axml": "xml",
  ".axaml": "xml",
  ".bpmn": "xml",
  ".cpt": "xml",
  ".csl": "xml",
  ".csproj": "xml",
  ".csproj.user": "xml",
  ".dita": "xml",
  ".ditamap": "xml",
  ".dtd": "xml",
  ".ent": "xml",
  ".mod": "xml",
  ".dtml": "xml",
  ".fsproj": "xml",
  ".fxml": "xml",
  ".iml": "xml",
  ".isml": "xml",
  ".jmx": "xml",
  ".launch": "xml",
  ".menu": "xml",
  ".mxml": "xml",
  ".nuspec": "xml",
  ".opml": "xml",
  ".owl": "xml",
  ".proj": "xml",
  ".props": "xml",
  ".pt": "xml",
  ".publishsettings": "xml",
  ".pubxml": "xml",
  ".pubxml.user": "xml",
  ".rbxlx": "xml",
  ".rbxmx": "xml",
  ".rdf": "xml",
  ".rng": "xml",
  ".rss": "xml",
  ".shproj": "xml",
  ".storyboard": "xml",
  ".svg": "xml",
  ".targets": "xml",
  ".tld": "xml",
  ".tmx": "xml",
  ".vbproj": "xml",
  ".vbproj.user": "xml",
  ".vcxproj": "xml",
  ".vcxproj.filters": "xml",
  ".wsdl": "xml",
  ".wxi": "xml",
  ".wxl": "xml",
  ".wxs": "xml",
  ".xaml": "xml",
  ".xbl": "xml",
  ".xib": "xml",
  ".xlf": "xml",
  ".xliff": "xml",
  ".xpdl": "xml",
  ".xul": "xml",
  ".xoml": "xml",
  ".xsl": "xsl",
  ".xslt": "xsl",
  ".yml": "yaml",
  ".eyaml": "yaml",
  ".eyml": "yaml",
  ".yaml": "yaml",
  ".cff": "yaml",
  ".link": "systemd-unit-file",
  ".netdev": "systemd-unit-file",
  ".network": "systemd-unit-file",
  ".service": "systemd-unit-file",
  ".socket": "systemd-unit-file",
  ".device": "systemd-unit-file",
  ".mount": "systemd-unit-file",
  ".automount": "systemd-unit-file",
  ".swap": "systemd-unit-file",
  ".target": "systemd-unit-file",
  ".path": "systemd-unit-file",
  ".timer": "systemd-unit-file",
  ".snapshot": "systemd-unit-file",
  ".slice": "systemd-unit-file",
  ".scope": "systemd-unit-file",
  ".s": "arm",
  ".S": "arm",
  ".asm": "arm",
  ".sx": "arm",
  ".pgn": "pgn",
  ".cmake": "cmake",
  ".j2": "jinja",
  ".jinja2": "jinja",
  ".d": "d",
  ".di": "d",
  ".nginx": "nginx"
};
declare global {
	interface ImportMeta {
		//@ts-ignore
		resolve: (moduleName: string) => string;
	}
}
let resolve = import.meta.resolve || ((path: string) => path);
const fontFace = new FontFace('seti', `url('${resolve(setiWoffUrl)}')`);
document.fonts.add(fontFace);
const readyPromise = document.fonts.load('16px seti');
export function iconPathForPath(fullPath: string, info: {dir: string, mode: number, size: number, isDirectory: boolean}) {
  function iconName() {
    if (info.isDirectory) {
      return '_folder';
    }
    if (iconDefs.fileNames[info.dir.toLowerCase()])
      return iconDefs.fileNames[info.dir.toLowerCase()];
    const ext = info.dir.substring(info.dir.lastIndexOf('.') + 1).toLowerCase();
    if (iconDefs.fileExtensions[ext])
      return iconDefs.fileExtensions[ext];
    const language = extensionToLanguage['.' + ext];
    if (language && iconDefs.languageIds[language])
      return iconDefs.languageIds[language];
    return iconDefs.file;
  }
  try {
    iconName();
  } catch (e) {
    console.error(e);
  }
  const {fontCharacter, fontColor} = iconDefs.iconDefinitions[iconName()];
  const element = document.createElement('span');
  element.classList.add('seti-icon');
  element.style.color = fontColor || '#ccc';
  element.textContent = '';
  element.setAttribute('data-font-character', fontCharacter);
  return {
    readyPromise,
    element
  }
}

export function looksLikeImageOrVideo(info: {dir: string, isDirectory: boolean}) {
	if (info.isDirectory)
		return false;
	const name = iconName();
	return name === '_image' || name === '_video' || name === '_svg';
	function iconName() {
		if (iconDefs.fileNames[info.dir.toLowerCase()])
			return iconDefs.fileNames[info.dir.toLowerCase()];
		const ext = info.dir.substring(info.dir.lastIndexOf('.') + 1).toLowerCase();
		if (iconDefs.fileExtensions[ext])
			return iconDefs.fileExtensions[ext];
		const language = extensionToLanguage['.' + ext];
		if (language && iconDefs.languageIds[language])
			return iconDefs.languageIds[language];
		return iconDefs.file;

	}
}

