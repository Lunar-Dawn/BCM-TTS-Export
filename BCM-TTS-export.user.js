// ==UserScript==
// @name         Battle Companies Manager TTS description exporter
// @namespace    lunarrequiem.net
// @version      0.1.1
// @description  Exports MESBG data to a format that can be pasted into TTS model descriptions
// @author       Lunar Dawn
// @match        https://battle-companies-manager.com/company/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=battle-companies-manager.com
// @grant        none
// @require      https://code.jquery.com/jquery-3.7.1.min.js
// @require      https://gist.github.com/raw/2625891/waitForKeyElements.js
// @require      https://raw.githubusercontent.com/Lunar-Dawn/BCM-TTS-Export/main/jszip.min.js
// @require      https://raw.githubusercontent.com/Lunar-Dawn/BCM-TTS-Export/main/FileSaver.min.js
// @updateURL    https://raw.githubusercontent.com/Lunar-Dawn/BCM-TTS-Export/main/BCM-TTS-export.user.js
// @downloadURL  https://raw.githubusercontent.com/Lunar-Dawn/BCM-TTS-Export/main/BCM-TTS-export.user.js
// ==/UserScript==

const styleTag = `
<style>
	.toolbar {
		position: fixed;
		top: 0;
		right: 0;

		display: grid;
		grid-template-columns: auto auto auto;
		column-gap: 5px;
		align-items: center;

		background: white;

		padding: 2px 2px 2px 6px;
		border-color: black;
		border-style: solid;
		border-width: 0 0 1px 1px;
		border-bottom-left-radius: 3px;
	}
	.toolbar > input {
		appearance: checkbox;
	}

	.card-toolbar {
        display: flex;

        border-top: 1px #636363 solid;
    }
    .card-toolbar > button {
        padding: 10px 0;
        flex: 1;
        border: 0;
        background: transparent;

        transition: background 0.1s;
    }
    .card-toolbar > button:hover {
        background: #DDD;

        transition: background 0.1s;
    }
</style>`;

const findReact = (dom, traverseUp = 0) => {
	const key = Object.keys(dom).find(key=>{
		return key.startsWith("__reactFiber$") // react 17+
			|| key.startsWith("__reactInternalInstance$"); // react <17
	});
	const domFiber = dom[key];
	if (domFiber == null) return null;

	// react <16
	if (domFiber._currentElement) {
		let compFiber = domFiber._currentElement._owner;
		for (let i = 0; i < traverseUp; i++) {
			compFiber = compFiber._currentElement._owner;
		}
		return compFiber._instance;
	}

	// react 16+
	const GetCompFiber = fiber=>{
		//return fiber._debugOwner; // this also works, but is __DEV__ only
		let parentFiber = fiber.return;
		while (typeof parentFiber.type == "string") {
			parentFiber = parentFiber.return;
		}
		return parentFiber;
	};
	let compFiber = GetCompFiber(domFiber);
	for (let i = 0; i < traverseUp; i++) {
		compFiber = GetCompFiber(compFiber);
	}
	return compFiber.stateNode;
}

const generateWarriorName = warrior => {
	switch(warrior.rank) {
		case 'Leader':
			return `[ffb000]${warrior.name} (L)[-]`

		case 'Sergeant':
			return `[cac0cc]${warrior.name} (S)[-]`

		case 'Hero':
			return `[9b6a54]${warrior.name} (H)[-]`

		case 'Warrior':
			return `[a19d94]${warrior.name}[-]`

		case 'Creature':
			return `[425562]${warrior.name} (C)[-]`

		case 'Wanderer':
			return `[425562]${warrior.name} (W)[-]`

		default:
			alert('Scream at Luna')
	}
}
const generateWarriorDesc = warrior => {
	let desc = '';

	const stats = warrior.totalStats;
	if(stats.might || stats.will || stats.fate) {
		desc += `${stats.might}/${stats.will}/${stats.fate}\n`
	}

	desc += 'Mv  F     S D A W C\n'
	desc += `${stats.move}" ${stats.fight}/${stats.shoot}+ ${stats.strength} ${stats.defence} ${stats.attacks} ${stats.wounds} ${stats.courage}\n\n`

	if(warrior.wargear.length !== 0) {
		desc += '[af9895]Wargear[-]\n'

		desc += warrior.wargear.filter(g => g.mount == 0).map(g => g.name).join('\n')

		desc += '\n\n'
	}
	if(warrior.specialRules.length !== 0) {
		desc += '[95b193]Special Rules[-]\n'
		
		desc += warrior.specialRules.map(r => r.name).join('\n')

		desc += '\n\n'
	}
	if(warrior.heroicActions.length !== 0) {
		desc += '[d3c07c]Heroic Actions[-]\n'

		desc += warrior.heroicActions.map(a => a.name).join('\n')

		desc += '\n\n'
	}
	if(warrior.spells.length !== 0) {
		desc += '[959daf]Spells[-]\n'

		desc += warrior.spells.map(s => `${s.name} ${s.baseCastingValue - s.modifyCastingValue}+`).join('\n')

		desc += '\n\n'
	}
	if(warrior.wargear.some(g => g.mount == 1)) {

		for (mount of warrior.wargear.filter(g => g.mount == 1)) {
			desc += `[ae00ff]${mount.name}[-]\n`

			desc += 'Mv  F     S D A W C\n'
			desc += `${mount.move}" ${mount.fight}/${mount.shoot}+ ${mount.strength} ${mount.defence} ${mount.attacks} ${mount.wounds} ${mount.courage}\n\n`
		}
	}

	return desc.trim()
}

const saveAll = warriors => {
	console.log(warriors)
	const zip = new JSZip()

	for(const w of Object.values(warriors)) {
		zip.file(`${w.name}.txt`, `${generateWarriorName(w)}\n\n${generateWarriorDesc(w)}\n`)
	}

	zip.generateAsync({type:"blob"})
		.then(b => saveAs(b, "export.zip"))
}

function markLastClicked(e) {
    const button = $(this)
    const span = button.find('span')

    span
        .fadeOut(
        	100, 
        	() => span.text('✔️ Copied')
        		.fadeIn(100)
        )

    setTimeout(() => {
        span
            .fadeOut(
            	100,
            	() => span.text(e.data.oldText)
            		.fadeIn(100)
            )
    }, 2000)
}
const createCardToolbar = (card, warriors) => {
	const warrior = warriors[parseInt(card.id.slice(5))]

	const toolbar = $(`<div>`)
		.addClass('card-toolbar')
		.addClass('checkbox-linked')
		.hide()

	$('<button><span>Copy Name</span></button>')
		.on('click', e => e.stopPropagation())
		.on('click', () => navigator.clipboard.writeText(generateWarriorName(warrior)))
		.on('click', { oldText: 'Copy Name' }, markLastClicked)
		.appendTo(toolbar)

	$('<button><span>Copy Description</span></button>')
		.on('click', e => e.stopPropagation())
		.on('click', () => navigator.clipboard.writeText(generateWarriorDesc(warrior)))
		.on('click', { oldText: 'Copy Description' }, markLastClicked)
		.appendTo(toolbar)

	return toolbar
}

const main = (cardGrid) => {
	'use strict';

	const cards = cardGrid.children('div.card')
	const warriors = findReact(cards[0], 1).props.warriors

	console.log(warriors)

	const toolbar = $('<div/>')
		.addClass('toolbar')

	const button = $("<button/>")
		.text('Export all')
		.addClass('export-all-button')
		.on('click', () => saveAll(warriors))
		.appendTo(toolbar)
		.addClass('checkbox-linked')
		.hide()
	const label = $('<label/>')
		.text('Enable export')
		.attr('for', 'activate-export')
		.appendTo(toolbar)
	const activate = $('<input/>')
		.attr('type', 'checkbox')
		.attr('id', 'activate-export')
		.on('change', e => {
			$('.checkbox-linked').toggle($(e.target).prop('checked'))
		})
		.appendTo(toolbar)

	$('head').append(styleTag)
	$('body').append(toolbar)
	cards
		.find('.card__front')
		.append(i => createCardToolbar(cards[i], warriors))
};

waitForKeyElements('.warrior-grid', main)
